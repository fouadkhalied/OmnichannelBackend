import { logger } from "../../../common/logger";

export class ShopifyClient {
    async validateToken(shopDomain: string, accessToken: string): Promise<boolean> {
        try {
            const url = `https://${shopDomain}/admin/api/2024-01/shop.json`;
            const response = await fetch(url, {
                headers: { "X-Shopify-Access-Token": accessToken }
            });
            return response.status === 200;
        } catch (err) {
            logger.error("shopify.validation_failed", { shopDomain, error: String(err) });
            return false;
        }
    }

    async registerWebhook(shopDomain: string, accessToken: string, topic: string, address: string): Promise<any> {
        try {
            const url = `https://${shopDomain}/admin/api/2024-01/webhooks.json`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    webhook: { topic, address, format: "json" }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Shopify webhook registration failed: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            return data.webhook;
        } catch (err) {
            logger.error("shopify.webhook_registration_failed", { shopDomain, topic, error: String(err) });
            throw err;
        }
    }
}
