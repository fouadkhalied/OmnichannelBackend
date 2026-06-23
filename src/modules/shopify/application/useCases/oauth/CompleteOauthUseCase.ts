import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
    normalizeAndValidateShopDomain,
    verifyShopifyCallbackHmac,
    verifySignedShopifyOauthState,
} from "../../../domain/valueObjects/ShopifyOauthState";
import { ShopifyWebhookRegistrationService } from "../../../domain/services/ShopifyWebhookRegistrationService";
import { UnauthorizedError } from "../../../../../libs/shared/domain/errors/UnauthorizedError";
import { env } from "../../../../../config/env";

import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

// CompleteOauthUseCase.ts

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
        // 1. Verify and extract state — contains everything we need
        const payload = verifySignedShopifyOauthState(
            input.state,
            env.SHOPIFY_OAUTH_STATE_SECRET || "dev-state-secret-change-me",
        );

        if (!payload) {
            throw new UnauthorizedError("Invalid or expired Shopify OAuth state");
        }

        const {
            organizationId,
            shopDomain,
            clientId,
            clientSecret,
            apiVersion,
        } = payload;

        // 2. Verify Shopify's callback HMAC using clientSecret from state
        const isValidHmac = verifyShopifyCallbackHmac({
            rawQuery: input.rawQuery,
            clientSecret,
        });

        if (!isValidHmac) {
            throw new UnauthorizedError("Invalid Shopify callback HMAC");
        }

        // 3. Validate the actual shop domain from callback matches state
        const params = new URLSearchParams(input.rawQuery);
        const actualShopDomain = normalizeAndValidateShopDomain(
            params.get("shop") || shopDomain
        );

        if (actualShopDomain !== shopDomain) {
            throw new UnauthorizedError("Shop domain mismatch");
        }

        // 4. Exchange code for access token
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

        const { access_token, scope } = await tokenResponse.json() as {
            access_token: string;
            scope: string;
        };

        // 5. Upsert Store → get storeId, then upsert credentials
        const storeId = await this.uowFactory.execute(async (uow) => {
            // Upsert store — creates if new, returns existing if reconnecting
            const store = await uow.stores.upsert({
                organizationId,
                name: actualShopDomain,
                platform: "shopify",
                storeUrl: actualShopDomain,
                shopifyClientId: clientId,
                shopifyClientSecret: clientSecret,
            });

            // Now we have storeId — upsert credentials
            await uow.credentials.upsert({
                organizationId,
                storeId: store.id,
                shopDomain: actualShopDomain,
                provider: "shopify",
                clientId,
                apiVersion,
                scopes: scope,
                encryptedCredentials: JSON.stringify({
                    accessToken: access_token,
                    clientSecret,
                    webhookSecret: clientSecret,
                    scopes: scope,
                }),
                status: "active",
                updatedAt: new Date(),
            });

            return store.id;
        });

        // 6. Register webhooks — outside transaction (external call)
        await this.webhookService.registerWebhooks({
            shopDomain: actualShopDomain,
            accessToken: access_token,
            webhookSecret: clientSecret,
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