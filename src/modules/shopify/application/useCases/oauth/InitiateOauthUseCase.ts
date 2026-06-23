import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    createSignedShopifyOauthState,
    normalizeAndValidateShopDomain,
} from "../../../domain/valueObjects/ShopifyOauthState";
import crypto from "crypto";
import { env } from "../../../../../config/env";
import { logger } from "../../../../../libs/common/logger";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

// InitiateOauthUseCase.ts

export interface InitiateOauthInput {
    shop: string;
    clientId: string;
    clientSecret: string;
}

export interface InitiateOauthOutput {
    redirectUrl: string;
}

export class InitiateOauthUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        // No uowFactory needed anymore
    ) {
        super(tenantContext);
    }

    async execute(input: InitiateOauthInput): Promise<InitiateOauthOutput> {
        const normalizedShop = normalizeAndValidateShopDomain(input.shop);

        const now = Date.now();
        const ttl = Number(env.SHOPIFY_OAUTH_STATE_TTL_MS) || 3600000;

        const stateToken = createSignedShopifyOauthState(
            {
                userId: (this.tenantContext as any).userId || "anonymous",
                organizationId: this.tenantContext.organizationId!,
                shopDomain: normalizedShop,
                clientId: input.clientId,
                clientSecret: input.clientSecret,  // ← in token, not DB
                apiVersion: "2025-01",
                nonce: crypto.randomBytes(16).toString("hex"),
                iat: now,
                exp: now + ttl,
            },
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        const scopes = env.SHOPIFY_OAUTH_SCOPES || "read_products,read_inventory,read_orders";
        const redirectUri = `${env.API_BASE_URL}/api/shopify/oauth/callback`;
        const redirectUrl = `https://${normalizedShop}/admin/oauth/authorize`
            + `?client_id=${input.clientId}`
            + `&scope=${encodeURIComponent(scopes)}`
            + `&redirect_uri=${encodeURIComponent(redirectUri)}`
            + `&state=${stateToken}`;

        logger.info("shopify.oauth_initiate", {
            shop: normalizedShop,
            clientId: `${input.clientId.slice(0, 4)}...`,
            redirectUrl,
        });

        return { redirectUrl };
    }
}