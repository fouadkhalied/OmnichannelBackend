import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { ConnectorCredentialModel } from "../../../../infrastructure/mongo/models";
import { UnauthorizedError } from "../../../../domain/errors/UnauthorizedError";
import { decryptCredentials } from "../../../../crypto/encrypt";
import { logger } from "../../../../../common/logger";
import { env } from "../../../../../../config/env";
import { runWithTenantContext } from "../../tenant/TenantResolver";

/**
 * WebhookShopDomainMiddleware
 * Does HMAC verification and Tenant resolution in a single step for multi-store support.
 * Replaces WebhookHmacMiddleware + TenantMiddleware on Shopify webhook routes.
 */
export const WebhookShopDomainMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const hmacHeader = req.headers["x-shopify-hmac-sha256"];
        const shopDomain = req.headers["x-shopify-shop-domain"] as string;

        if (!shopDomain) {
            return next(new UnauthorizedError("X-Shopify-Shop-Domain header missing"));
        }

        if (!hmacHeader) {
            return next(new UnauthorizedError("X-Shopify-Hmac-Sha256 header missing"));
        }

        // 1. Find the store in DB to get its specific webhook secret
        const credentialDoc = await ConnectorCredentialModel.findOne({
            provider: "shopify",
            shopDomain: shopDomain.toLowerCase(),
        }).lean();

        if (!credentialDoc) {
            // Do NOT reveal why it failed for security
            logger.warn("webhook.domain_not_found", { shopDomain });
            return next(new UnauthorizedError("Unauthorized access"));
        }

        // 2. Decrypt credentials to get the specific secret for THIS store
        const encryptionSecret = env.CONNECTOR_ENCRYPTION_SECRET;
        const decrypted = decryptCredentials(credentialDoc.encryptedCredentials, encryptionSecret);
        const webhookSecret = String(decrypted.webhookSecret || "");

        if (!webhookSecret) {
            logger.error("webhook.secret_missing_in_db", { shopDomain });
            return next(new UnauthorizedError("Internal server error"));
        }

        // 3. Re-verify HMAC using THIS store's webhookSecret
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
            return next(new UnauthorizedError("Raw body missing for validation"));
        }

        const computedHash = createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("base64");

        if (
            !timingSafeEqual(
                Buffer.from(computedHash),
                Buffer.from(String(hmacHeader)),
            )
        ) {
            logger.warn("webhook.hmac_mismatch", { shopDomain });
            return next(new UnauthorizedError("HMAC validation failed"));
        }

        // 4. Build TenantContext
        const organizationId = credentialDoc.organizationId;
        const storeId = credentialDoc.storeId;

        const tenantContext = {
            tenantId: `${organizationId}:${storeId}`,
            organizationId,
            storeId,
            plan: "pro", // TODO: fetch from subscription model if available
            features: [],
            limits: {},
        };

        // Attach to request
        (req as any).tenantContext = tenantContext;

        // 5. Run nested within context
        runWithTenantContext(tenantContext, () => {
            next();
        });
    } catch (error) {
        logger.error("webhook.middleware_failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};
