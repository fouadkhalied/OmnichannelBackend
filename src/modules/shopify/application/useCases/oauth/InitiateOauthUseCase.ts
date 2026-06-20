import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    createSignedShopifyOauthState,
    normalizeAndValidateShopDomain,
} from "../../../domain/valueObjects/ShopifyOauthState";
import crypto from "crypto";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { Vault } from "../../../../../libs/shared/crypto/vault";
import { env } from "../../../../../config/env";
import { logger } from "../../../../../libs/common/logger";

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
        private readonly uowFactory: UnitOfWorkFactory,
    ) {
        super(tenantContext);
    }

    async execute(input: InitiateOauthInput): Promise<InitiateOauthOutput> {
        // 1. Fetch Tenant Infrastructure Credentials
        const tenantId = this.tenantContext.tenantId;
        const tenantInfra = await this.uowFactory.execute(async (uow) => {
            return await uow.tenantN8n.findById(tenantId!);
        });

        if (!tenantInfra || !tenantInfra.shopifyAppClientIdEncrypted || !tenantInfra.shopifyAppClientSecretEncrypted) {
            throw new Error(`Shopify App credentials not found for tenant ${tenantId}. Please register them first.`);
        }

        // 2. Decrypt Credentials
        const clientId = Vault.decrypt({
            ciphertext: tenantInfra.shopifyAppClientIdEncrypted!,
            iv: tenantInfra.iv
        });
        const clientSecret = Vault.decrypt({
            ciphertext: tenantInfra.shopifyAppClientSecretEncrypted!,
            iv: tenantInfra.iv
        });

        // 3. Normalize and validate shop domain
        const normalizedShop = normalizeAndValidateShopDomain(input.shopDomain);

        // 4. Build ShopifyOauthStatePayload
        const nonce = crypto.randomBytes(16).toString("hex");
        const now = Date.now();
        const ttl = Number(env.SHOPIFY_OAUTH_STATE_TTL_MS) || 3600000;

        const stateToken = createSignedShopifyOauthState(
            {
                userId: input.userId,
                organizationId: input.organizationId,
                storeId: input.storeId,
                shopDomain: normalizedShop,
                clientId: clientId,
                clientSecret: clientSecret,
                apiVersion: input.apiVersion,
                nonce,
                iat: now,
                exp: now + ttl,
            },
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        // 5. Build Shopify auth URL
        // https://{shopDomain}/admin/oauth/authorize
        //   ?client_id={SHOPIFY_APP_CLIENT_ID}
        //   &scope={SHOPIFY_OAUTH_SCOPES}
        //   &redirect_uri={API_BASE_URL}/api/shopify/oauth/callback
        //   &state={signedState}

        const scopes = env.SHOPIFY_OAUTH_SCOPES;
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
