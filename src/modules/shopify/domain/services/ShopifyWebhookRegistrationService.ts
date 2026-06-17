import { logger } from "server/common/logger";
import { env } from "../../../../config/env";


export interface RegisterWebhooksInput {
    shopDomain: string;
    accessToken: string;
    webhookSecret: string;
    organizationId: string;
    storeId: string;
}

export class ShopifyWebhookRegistrationService {
    private readonly topics = [
        "products/update",
        "customers/update",
    ];

    async registerWebhooks(input: RegisterWebhooksInput): Promise<void> {
        const webhookUrl = `${env.API_BASE_URL}/api/shopify/webhook`;

        for (const topic of this.topics) {
            try {
                const response = await fetch(
                    `https://${input.shopDomain}/admin/api/2025-01/webhooks.json`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Shopify-Access-Token": input.accessToken,
                        },
                        body: JSON.stringify({
                            webhook: {
                                topic,
                                address: webhookUrl,
                                format: "json",
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    const error = await response.text();
                    logger.warn("shopify.webhook_registration_failed", {
                        shopDomain: input.shopDomain,
                        topic,
                        status: response.status,
                        error,
                    });
                } else {
                    logger.info("shopify.webhook_registered", {
                        shopDomain: input.shopDomain,
                        topic,
                    });
                }
            } catch (error) {
                logger.error("shopify.webhook_registration_error", {
                    shopDomain: input.shopDomain,
                    topic,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
}
