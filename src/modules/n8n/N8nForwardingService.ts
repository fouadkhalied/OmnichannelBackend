import { IN8nInstanceRepository } from "../shopify/domain/repositories/IN8nInstanceRepository";
import { decryptCredentials } from "../../libs/shared/crypto/encrypt";
import { logger } from "../../libs/common/logger";

export interface ForwardWebhookInput {
    organizationId: string;
    topic: string;
    payload: any;
    tenantId: string;
}

export class N8nForwardingService {
    constructor(
        private readonly n8nRepository: IN8nInstanceRepository,
    ) { }

    async forwardWebhookEvent(input: ForwardWebhookInput): Promise<void> {
        try {
            // 1. Find the n8n instance for this organization
            const instance = await this.n8nRepository.findByOrganizationId(input.organizationId);

            if (!instance || instance.status !== "active") {
                logger.debug("n8n.forwarding_skipped: instance not found or not active", {
                    organizationId: input.organizationId,
                });
                return;
            }

            // 2. Decrypt API Key
            const secret = process.env.CONNECTOR_ENCRYPTION_SECRET;
            const decrypted = decryptCredentials(instance.n8nApiKeyEnc, secret);
            const apiKey = String(decrypted.apiKey || "");

            // 3. Build Webhook URL
            // Format assumed: instance.n8nSpaceUrl + /webhook/ + some path
            // For now we use a generic path /shopify/webhooks
            const targetUrl = `${instance.n8nSpaceUrl}/webhook/shopify/webhooks`;

            // 4. POST to n8n
            const response = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Webhook-Secret": instance.n8nWebhookSecret,
                    "X-Tenant-Id": input.tenantId,
                    "X-Shopify-Topic": input.topic,
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(input.payload),
                signal: (AbortSignal as any).timeout(10000), // 10s timeout
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.warn("n8n.forwarding_failed", {
                    organizationId: input.organizationId,
                    url: targetUrl,
                    status: response.status,
                    error: errorText,
                });
            } else {
                logger.debug("n8n.forwarding_success", {
                    organizationId: input.organizationId,
                    topic: input.topic,
                });
            }
        } catch (error) {
            // Never throw - this is a secondary/background action
            logger.error("n8n.forwarding_error", {
                organizationId: input.organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
