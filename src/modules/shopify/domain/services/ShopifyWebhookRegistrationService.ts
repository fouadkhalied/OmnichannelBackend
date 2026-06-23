// ShopifyWebhookRegistrationService.ts — updated

import { env } from "src/config/env";
import { logger } from "src/libs/common/logger";

export interface RegisterWebhooksInput {
    shopDomain: string;
    accessToken: string;
    webhookSecret: string;
    organizationId: string;
    storeId: string;
}

export class ShopifyWebhookRegistrationService {
    private readonly topics = ["products/update", "customers/update", "orders/create", "orders/updated"];

    async registerWebhooks(input: RegisterWebhooksInput): Promise<void> {
        const endpoints = [
            `${env.API_BASE_URL}/api/shopify/webhook`,
            `${env.N8N_WEBHOOK_URL}`,
        ].filter(Boolean);

        for (const topic of this.topics) {
            for (const address of endpoints) {
                await this.register({ ...input, topic, address });
            }
        }
    }

    private async register(input: { shopDomain: string; accessToken: string; topic: string; address: string }): Promise<void> {
        const response = await fetch(
            `https://${input.shopDomain}/admin/api/2025-01/webhooks.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": input.accessToken,
                },
                body: JSON.stringify({
                    webhook: { topic: input.topic, address: input.address, format: "json" },
                }),
            }
        );
        if (!response.ok) {
            const err = await response.text();
            logger.warn("shopify.webhook_registration_failed", { topic: input.topic, address: input.address, err });
        } else {
            logger.info("shopify.webhook_registered", { topic: input.topic, address: input.address });
        }
    }
}