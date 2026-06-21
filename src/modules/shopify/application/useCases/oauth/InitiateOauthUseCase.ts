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
        private readonly uowFactory: UnitOfWorkFactory,
    ) {
        super(tenantContext);
    }

    async execute(input: InitiateOauthInput): Promise<InitiateOauthOutput> {
        const normalizedShop = normalizeAndValidateShopDomain(input.shop);

        // 1. Save credentials to Store record
        await this.uowFactory.execute(async (uow) => {
            const storeId = this.tenantContext.storeId;
            if (!storeId) throw new Error("Store ID missing in tenant context.");

            await uow.stores.upsert({
                id: storeId,
                organizationId: this.tenantContext.organizationId!,
                name: normalizedShop, // or keep existing name
                shopifyClientId: input.clientId,
                shopifyClientSecret: input.clientSecret,
                storeUrl: normalizedShop,
            });
        });

        const clientId = input.clientId;
        const nonce = crypto.randomBytes(16).toString("hex");
        const now = Date.now();
        const ttl = Number(env.SHOPIFY_OAUTH_STATE_TTL_MS) || 3600000;

        const stateToken = createSignedShopifyOauthState(
            {
                userId: (this.tenantContext as any).userId || "anonymous",
                organizationId: this.tenantContext.organizationId!,
                storeId: this.tenantContext.storeId!,
                shopDomain: normalizedShop,
                clientId: clientId,
                apiVersion: "2025-01",
                nonce,
                iat: now,
                exp: now + ttl,
            },
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        const scopes = env.SHOPIFY_OAUTH_SCOPES || "read_products,read_inventory,read_customers,read_orders,read_fulfillments";
        const redirectUri = `${env.API_BASE_URL}/api/shopify/oauth/callback`;
        const redirectUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}`;

        logger.info("shopify.oauth_initiate", {
            shop: normalizedShop,
            clientId: clientId ? `${clientId.slice(0, 4)}...` : "MISSING",
            redirectUri,
            scopes,
            redirectUrl: redirectUrl
        });

        return { redirectUrl };
    }
}