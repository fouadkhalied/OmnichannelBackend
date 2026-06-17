import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import {
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
        // 1. Verify HMAC
        const isValidHmac = verifyShopifyCallbackHmac({
            rawQuery: input.rawQuery,
            clientSecret: env.SHOPIFY_APP_CLIENT_SECRET || "",
        });

        if (!isValidHmac) {
            throw new UnauthorizedError("Invalid Shopify callback HMAC");
        }

        // 2. Verify State
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

        const { organizationId, storeId, shopDomain, apiVersion } = payload;

        // 3. Exchange code for access token
        const tokenResponse = await fetch(
            `https://${shopDomain}/admin/oauth/access_token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: env.SHOPIFY_APP_CLIENT_ID || "",
                    client_secret: env.SHOPIFY_APP_CLIENT_SECRET || "",
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

        // 4. Use global App Client Secret for webhooks (standard for Shopify Public Apps)
        const webhookSecret = env.SHOPIFY_APP_CLIENT_SECRET!;

        // 5. Save credentials
        await this.connectorRepository.upsertCredentials({
            organizationId,
            storeId,
            shopDomain,
            accessToken: access_token,
            apiVersion,
            webhookSecret,
            scopes: scope,
        });

        // 6. Register webhooks
        // Note: This is an async fire-and-forget or we can wait for it.
        // The spec implies it's part of the flow.
        await this.webhookService.registerWebhooks({
            shopDomain,
            accessToken: access_token,
            webhookSecret,
            organizationId,
            storeId,
        });

        return {
            organizationId,
            storeId,
            shopDomain,
            scopes: scope,
        };
    }
}
