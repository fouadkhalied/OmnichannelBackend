import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    normalizeAndValidateShopDomain,
    verifyShopifyCallbackHmac,
    verifySignedShopifyOauthState,
} from "../../../domain/valueObjects/ShopifyOauthState";
import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { ShopifyWebhookRegistrationService } from "../../../domain/services/ShopifyWebhookRegistrationService";
import { UnauthorizedError } from "../../../../../libs/shared/domain/errors/UnauthorizedError";
import crypto from "crypto";
import { env } from "../../../../../config/env";

export interface CompleteOauthInput {
    code: string;
    state: string;
    rawQuery: string;
}

export interface CompleteOauthOutput {
    organizationId: string;
    storeId: string;
    shopDomain: string;
    scopes: string;
}

export class CompleteOauthUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly connectorRepository: IConnectorRepository,
        private readonly webhookService: ShopifyWebhookRegistrationService,
    ) {
        super(tenantContext);
    }

    async execute(input: CompleteOauthInput): Promise<CompleteOauthOutput> {
        // 2. Verify State (need state first to get clientSecret for HMAC check)
        const payload = verifySignedShopifyOauthState(
            input.state,
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        if (!payload) {
            throw new UnauthorizedError("Invalid Shopify OAuth state");
        }

        if (payload.exp < Date.now()) {
            throw new UnauthorizedError("Shopify OAuth state expired");
        }

        const { organizationId, storeId, apiVersion, clientId, clientSecret } = payload;

        // 0. Extract the actual shop domain from the callback query (this is the definitive .myshopify.com domain)
        const params = new URLSearchParams(input.rawQuery);
        const actualShopDomain = normalizeAndValidateShopDomain(params.get("shop") || payload.shopDomain);

        // 1. Verify Callback HMAC using the clientSecret from the state
        const isValidHmac = verifyShopifyCallbackHmac({
            rawQuery: input.rawQuery,
            clientSecret: clientSecret,
        });

        if (!isValidHmac) {
            throw new UnauthorizedError("Invalid Shopify callback HMAC");
        }

        // 3. Exchange code for access token
        const tokenResponse = await fetch(
            `https://${actualShopDomain}/admin/oauth/access_token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: input.code,
                }),
            }
        );

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new Error(`Failed to exchange Shopify OAuth code: ${error}`);
        }

        const { access_token, scope } = (await tokenResponse.json()) as {
            access_token: string;
            scope: string;
        };

        // 4. Use the custom Client Secret from the OAuth initiation for webhooks
        const webhookSecret = clientSecret;

        // 5. Save credentials
        await this.connectorRepository.upsertCredentials({
            organizationId,
            storeId,
            shopDomain: actualShopDomain,
            accessToken: access_token,
            clientId,
            clientSecret,
            apiVersion,
            webhookSecret,
            scopes: scope,
        });

        // 6. Register webhooks
        await this.webhookService.registerWebhooks({
            shopDomain: actualShopDomain,
            accessToken: access_token,
            webhookSecret,
            organizationId,
            storeId,
        });

        return {
            organizationId,
            storeId,
            shopDomain: actualShopDomain,
            scopes: scope,
        };
    }
}
