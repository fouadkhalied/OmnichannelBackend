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

import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { N8nClient } from "../../../../../libs/shared/infrastructure/external/N8nClient";
import { Vault } from "../../../../../libs/shared/crypto/vault";

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
        private readonly uowFactory: UnitOfWorkFactory,
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

        const { organizationId, storeId, apiVersion, clientId } = payload;

        // 1. Fetch credentials from DB
        const store = await this.uowFactory.execute(async (uow) => {
            return uow.stores.findById(storeId);
        });

        if (!store || !store.shopifyClientId || !store.shopifyClientSecret) {
            throw new Error(`Store credentials not found for store ${storeId}. Please re-initiate OAuth.`);
        }

        const shopifyClientId = store.shopifyClientId;
        const shopifyClientSecret = store.shopifyClientSecret;

        // 0. Extract the actual shop domain from the callback query
        const params = new URLSearchParams(input.rawQuery);
        const actualShopDomain = normalizeAndValidateShopDomain(params.get("shop") || payload.shopDomain);

        // 2. Verify Callback HMAC using the clientSecret from DB
        const isValidHmac = verifyShopifyCallbackHmac({
            rawQuery: input.rawQuery,
            clientSecret: shopifyClientSecret,
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
                    client_id: shopifyClientId,
                    client_secret: shopifyClientSecret,
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

        // 4. Use the custom Client Secret from the DB for webhooks
        const webhookSecret = shopifyClientSecret;

        // 5. Save credentials and Sync
        await this.uowFactory.execute(async (uow) => {
            // Save official Shopify credentials for the backend
            await uow.credentials.upsert({
                organizationId,
                storeId,
                shopDomain: actualShopDomain,
                provider: "shopify",
                clientId: shopifyClientId,
                apiVersion,
                scopes: scope,
                encryptedCredentials: JSON.stringify({
                    accessToken: access_token,
                    clientSecret: shopifyClientSecret,
                    webhookSecret,
                    scopes: scope,
                }),
                status: "active",
                updatedAt: new Date(),
            });

            // 6. Register webhooks (Backend directly calls Shopify)
            await this.webhookService.registerWebhooks({
                shopDomain: actualShopDomain,
                accessToken: access_token,
                webhookSecret,
                organizationId,
                storeId,
            });

        });

        return {
            organizationId,
            storeId,
            shopDomain: actualShopDomain,
            scopes: scope,
        };
    }
}
