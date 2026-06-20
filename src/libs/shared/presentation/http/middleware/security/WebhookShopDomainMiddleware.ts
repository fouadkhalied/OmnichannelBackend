import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { UnauthorizedError } from "../../../../domain/errors/UnauthorizedError";
import { logger } from "../../../../../common/logger";
import { runWithTenantContext } from "../../tenant/TenantResolver";
import { UnitOfWorkFactory } from "../../../../infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { Vault } from "../../../../crypto/vault";
import { TenantContext, TenantPlan } from "../../../../domain/valueObjects/TenantContext";

import { PgConnectorRepository } from "../../../../infrastructure/postgres/repositories/PgConnectorRepository";

export const createWebhookShopDomainMiddleware = (uowFactory: UnitOfWorkFactory) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const hmacHeader = req.headers["x-shopify-hmac-sha256"];
            const shopDomain = req.headers["x-shopify-shop-domain"] as string;

            if (!shopDomain) {
                return next(new UnauthorizedError("X-Shopify-Shop-Domain header missing"));
            }

            if (!hmacHeader) {
                return next(new UnauthorizedError("X-Shopify-Hmac-Sha256 header missing"));
            }

            // 1. Find the store in Postgres
            const db = uowFactory.getDb();
            const connectorRepo = new PgConnectorRepository(db);

            const identity = await connectorRepo.findByShopDomain(shopDomain.toLowerCase());
            if (!identity) {
                logger.warn("webhook.domain_not_found", { shopDomain });
                return next(new UnauthorizedError("Unauthorized access"));
            }

            const credentials = await connectorRepo.getCredentials(identity.tenantId);
            const webhookSecret = credentials.clientSecret;

            if (!webhookSecret) {
                logger.error("webhook.secret_missing_in_db", { shopDomain });
                return next(new UnauthorizedError("Internal server error"));
            }

            // 3. Re-verify HMAC using THIS store's webhookSecret
            const rawBody = (req as any).rawBody;
            if (!rawBody || !Buffer.isBuffer(rawBody)) {
                logger.error("webhook.raw_body_missing_or_invalid", {
                    shopDomain,
                    hasRawBody: !!rawBody,
                    isBuffer: Buffer.isBuffer(rawBody)
                });
                return next(new UnauthorizedError("Raw body missing for validation"));
            }

            const computedHash = createHmac("sha256", webhookSecret)
                .update(rawBody)
                .digest();

            const hmacBuffer = Buffer.from(String(hmacHeader), "base64");

            if (
                computedHash.length !== hmacBuffer.length ||
                !timingSafeEqual(computedHash, hmacBuffer)
            ) {
                logger.warn("webhook.hmac_mismatch", {
                    shopDomain,
                    expectedLength: hmacBuffer.length,
                    computedLength: computedHash.length
                });
                return next(new UnauthorizedError("HMAC validation failed"));
            }

            // 4. Build TenantContext
            const tenantContext: TenantContext = {
                tenantId: identity.tenantId,
                organizationId: identity.organizationId,
                storeId: identity.storeId,
                plan: TenantPlan.PRO,
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
};
