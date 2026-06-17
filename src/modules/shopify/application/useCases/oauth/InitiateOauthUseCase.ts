import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    createSignedShopifyOauthState,
    normalizeAndValidateShopDomain,
} from "../../../domain/valueObjects/ShopifyOauthState";
import crypto from "crypto";
import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { env } from "../../../../../config/env";
import { logger } from "../../../../../libs/common/logger";

export interface InitiateOauthInput {
    userId: string;
    organizationId: string;
    storeId: string;
    shopDomain: string;
    clientId: string;
    clientSecret: string;
    apiVersion: string;
}

export interface InitiateOauthOutput {
    redirectUrl: string;
}

export class InitiateOauthUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly connectorRepository: IConnectorRepository,
    ) {
        super(tenantContext);
    }

    async execute(input: InitiateOauthInput): Promise<InitiateOauthOutput> {
        // 1. Normalize and validate shop domain
        const normalizedShop = normalizeAndValidateShopDomain(input.shopDomain);

        // 2. Build ShopifyOauthStatePayload
        const nonce = crypto.randomBytes(16).toString("hex");
        const now = Date.now();
        const ttl = env.SHOPIFY_OAUTH_STATE_TTL_MS;

        const stateToken = createSignedShopifyOauthState(
            {
                userId: input.userId,
                organizationId: input.organizationId,
                storeId: input.storeId,
                shopDomain: normalizedShop,
                clientId: input.clientId,
                clientSecret: input.clientSecret,
                apiVersion: input.apiVersion,
                nonce,
                iat: now,
                exp: now + ttl,
            },
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        // 3. Build Shopify auth URL
        // https://{shopDomain}/admin/oauth/authorize
        //   ?client_id={SHOPIFY_APP_CLIENT_ID}
        //   &scope={SHOPIFY_OAUTH_SCOPES}
        //   &redirect_uri={API_BASE_URL}/api/shopify/oauth/callback
        //   &state={signedState}

        const scopes = env.SHOPIFY_OAUTH_SCOPES;
        const clientId = input.clientId;
        const redirectUri = `${env.API_BASE_URL}/api/shopify/oauth/callback`;
        const redirectUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}`;

        logger.info("shopify.oauth_initiate", {
            shop: normalizedShop,
            clientId: clientId ? `${clientId.slice(0, 4)}...` : "MISSING",
            redirectUri,
            scopes,
            fullUrl: redirectUrl
        });

        return { redirectUrl };
    }
}
