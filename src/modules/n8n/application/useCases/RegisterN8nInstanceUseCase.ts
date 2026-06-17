import { BaseService } from "../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../libs/shared/domain/valueObjects/TenantContext";
import { IN8nInstanceRepository } from "../../../shopify/domain/repositories/IN8nInstanceRepository";
import { encryptCredentials } from "../../../../libs/shared/crypto/encrypt";
import { env } from "../../../../config/env";
import crypto from "crypto";

export interface RegisterN8nInstanceInput {
    organizationId: string;
    n8nSpaceUrl: string;
    n8nApiKey: string;
}

export class RegisterN8nInstanceUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly n8nRepository: IN8nInstanceRepository,
    ) {
        super(tenantContext);
    }

    async execute(input: RegisterN8nInstanceInput): Promise<void> {
        // 1. Normalize URL
        const n8nSpaceUrl = input.n8nSpaceUrl.trim().replace(/\/+$/, "");

        // 2. Encrypt API Key
        const secret = process.env.CONNECTOR_ENCRYPTION_SECRET;
        if (!secret) {
            throw new Error("CONNECTOR_ENCRYPTION_SECRET is not configured");
        }

        const n8nApiKeyEnc = encryptCredentials(
            JSON.stringify({ apiKey: input.n8nApiKey }),
            secret
        );

        // 3. Generate a separate webhook secret for n8n -> backend (optional but good for future)
        const n8nWebhookSecret = crypto.randomBytes(32).toString("hex");

        // 4. Upsert
        await this.n8nRepository.upsert({
            id: crypto.randomUUID(),
            organizationId: input.organizationId,
            n8nSpaceUrl,
            n8nApiKeyEnc,
            n8nWebhookSecret,
            status: "active",
        });
    }
}
