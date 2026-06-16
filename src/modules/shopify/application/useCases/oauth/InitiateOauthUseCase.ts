import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    createSignedShopifyOauthState,
    normalizeAndValidateShopDomain,
} from "../../../domain/valueObjects/ShopifyOauthState";
import crypto from "crypto";
import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { env } from "../../../../../config/env";

export interface InitiateOauthInput {
    userId: string;
    organizationId: string;
    storeId: string;
    shopDomain: string;
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
        const clientId = env.SHOPIFY_APP_CLIENT_ID;
        const redirectUri = `${env.API_BASE_URL}/api/shopify/oauth/callback`;
        const redirectUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}`;

        return { redirectUrl };
    }
}
