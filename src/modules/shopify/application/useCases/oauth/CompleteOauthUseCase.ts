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

        // 5. Save credentials and Sync
        await this.uowFactory.execute(async (uow) => {
            // Save official Shopify credentials for the backend
            await uow.credentials.upsert({
                organizationId,
                storeId,
                shopDomain: actualShopDomain,
                provider: "shopify",
                clientId,
                apiVersion,
                scopes: scope,
                encryptedCredentials: JSON.stringify({
                    accessToken: access_token,
                    clientSecret,
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

            // 7. Update n8n Infrastructure
            const tenantN8n = await uow.tenantN8n.findByTenantId(organizationId); // Assuming organizationId is tenantId
            if (tenantN8n) {
                const n8n = new N8nClient(tenantN8n.n8nBaseUrl!);
                const n8nApiKey = Vault.decrypt({ ciphertext: tenantN8n.n8nApiKeyEncrypted!, iv: tenantN8n.iv });

                // Update the Shopify credential in n8n (from PENDING_OAUTH to real token)
                if (tenantN8n.n8nShopifyCredentialId) {
                    await n8n.updateCredential(n8nApiKey, tenantN8n.n8nShopifyCredentialId, {
                        name: `shopify-${organizationId}`,
                        type: "httpHeaderAuth",
                        data: { name: "X-Shopify-Access-Token", value: access_token }
                    });
                }

                // Trigger Initial Sync in n8n
                if (tenantN8n.n8nIngestionWorkflowId) {
                    await n8n.runWorkflow(n8nApiKey, tenantN8n.n8nIngestionWorkflowId, { mode: "full_sync" });
                }
            }
        });

        return {
            organizationId,
            storeId,
            shopDomain: actualShopDomain,
            scopes: scope,
        };
    }
}
