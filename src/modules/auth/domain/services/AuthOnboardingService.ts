import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";
import { Vault } from "../../../../libs/shared/crypto/vault";
import { runVectorMigrations } from "../../../../../server/migrations/runner";
import { hashPassword } from "../../../../libs/shared/crypto/password";
import { logger } from "../../../../libs/common/logger";
import { ShopifyClient } from "../../../../libs/shared/infrastructure/external/ShopifyClient";
import { HuggingFaceClient } from "../../../../libs/shared/infrastructure/external/HuggingFaceClient";
import { N8nClient } from "../../../../libs/shared/infrastructure/external/N8nClient";

import { TenantPlan } from "../../../../libs/shared/domain/valueObjects/TenantContext";

export interface OnboardingData {
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    shopDomain: string;
    shopifyAppClientId: string;
    shopifyAppClientSecret: string;
    neonConnectionString: string;
    openaiApiKey: string;
    hfToken: string;
    hfUsername: string;
    plan?: TenantPlan;
}

export class AuthOnboardingService {
    private shopify = new ShopifyClient();

    async onboard(
        uow: IUnitOfWork,
        data: OnboardingData,
        onProgress: (status: string) => void
    ) {
        onProgress("Starting onboarding: Validating domain...");

        // 1 & 2: Validation
        if (!data.shopDomain.endsWith(".myshopify.com")) {
            throw new Error("Invalid Shopify store domain. Must be {shop}.myshopify.com");
        }

        const hfClient = new HuggingFaceClient(data.hfUsername);
        const tenantId = crypto.randomUUID();

        // 3: Create HF Space
        onProgress("Creating Hugging Face Space for n8n...");
        const spaceName = `n8n-${tenantId}`;
        const space = await hfClient.createSpace(spaceName, data.hfToken);
        const n8nBaseUrl = `https://${data.hfUsername}-${spaceName}.hf.space`;

        // 4: Push Dockerfile
        onProgress("Pushing n8n deployment templates to Hugging Face...");
        const templateDir = path.resolve(process.cwd(), "n8n-deployment");
        await hfClient.pushDockerfile(spaceName, data.hfToken, templateDir);

        // 5: Inject Secrets
        onProgress("Injecting environment secrets into HF Space...");
        const n8nEncryptionKey = crypto.randomUUID();
        const n8nApiKey = crypto.randomBytes(32).toString("hex");
        const n8nOwnerPassword = crypto.randomBytes(16).toString("hex");
        const shopifyWebhookSecret = crypto.randomBytes(16).toString("hex");

        const secrets = {
            N8N_ENCRYPTION_KEY: n8nEncryptionKey,
            N8N_API_KEY: n8nApiKey,
            DATABASE_URL: data.neonConnectionString,
            TENANT_ID: tenantId,
            SHOP_DOMAIN: data.shopDomain,
            SHOP_NAME: data.companyName,
            OPENAI_API_KEY: data.openaiApiKey,
            BACKEND_URL: process.env.API_BASE_URL || "http://localhost:5000",
            SHOPIFY_WEBHOOK_SECRET: shopifyWebhookSecret,
            EMBEDDING_MODEL: "text-embedding-3-small",
            N8N_BASIC_AUTH_ACTIVE: "true",
            N8N_BASIC_AUTH_USER: "admin",
            N8N_BASIC_AUTH_PASSWORD: n8nOwnerPassword,
            WEBHOOK_URL: n8nBaseUrl,
            N8N_HOST: `${data.hfUsername}-${spaceName}.hf.space`,
            PORT: "7860"
        };

        for (const [key, value] of Object.entries(secrets)) {
            await hfClient.setSecret(spaceName, data.hfToken, key, value);
        }

        // 6: Poll for Health
        onProgress("Waiting for n8n instance to boot...");
        const n8n = new N8nClient(n8nBaseUrl);
        let isReady = false;
        for (let i = 0; i < 36; i++) {
            if (await n8n.checkHealth()) {
                isReady = true;
                break;
            }
            await new Promise(r => setTimeout(r, 5000));
        }

        if (!isReady) throw new Error("n8n instance failed to boot.");

        // 7: n8n Owner Setup
        onProgress("Setting up n8n owner account...");
        await n8n.ownerSetup({
            email: `n8n-owner-${tenantId}@internal.service`,
            password: n8nOwnerPassword,
            firstName: "Internal",
            lastName: "Service"
        });

        // 8: Create n8n Credentials
        onProgress("Configuring n8n credentials for Neon and Shopify...");
        const shopifyCredId = await n8n.createCredential(n8nApiKey, {
            name: `shopify-${tenantId}`,
            type: "httpHeaderAuth",
            data: { name: "X-Shopify-Access-Token", value: "PENDING_OAUTH" }
        });

        const openaiCredId = await n8n.createCredential(n8nApiKey, {
            name: `openai-${tenantId}`,
            type: "openAiApi",
            data: { apiKey: data.openaiApiKey }
        });

        // Parse Neon connection string for n8n Postgres node
        // format: postgresql://user:pass@host:port/db?sslmode=require
        const neonUrl = new URL(data.neonConnectionString);
        const postgresCredId = await n8n.createCredential(n8nApiKey, {
            name: `neon-${tenantId}`,
            type: "postgres",
            data: {
                host: neonUrl.hostname,
                port: parseInt(neonUrl.port) || 5432,
                database: neonUrl.pathname.slice(1),
                user: neonUrl.username,
                password: neonUrl.password,
                ssl: "require"
            }
        });

        // 9: Deploy Workflows (Substitution Step)
        onProgress("Deploying master workflows (Ingestion & Chat)...");
        const substitutionMap: Record<string, string> = {
            '{{TENANT_ID}}': tenantId,
            '{{SHOP_DOMAIN}}': data.shopDomain,
            '{{SHOP_NAME}}': data.companyName,
            '{{SHOPIFY_CREDENTIAL_ID}}': shopifyCredId,
            '{{OPENAI_CREDENTIAL_ID}}': openaiCredId,
            '{{POSTGRES_CREDENTIAL_ID}}': postgresCredId,
        };

        const templates = [
            { file: "ingestion-workflow.json", label: "Ingestion" },
            { file: "chat-workflow.json", label: "Chat" }
        ];

        const workflowIds: Record<string, string> = {};

        for (const template of templates) {
            const templatePath = path.resolve(process.cwd(), "workflow-templates", template.file);
            let raw = fs.readFileSync(templatePath, "utf8");

            for (const [placeholder, value] of Object.entries(substitutionMap)) {
                raw = raw.replaceAll(placeholder, value);
            }

            const workflowJson = JSON.parse(raw);
            const workflowId = await n8n.deployWorkflow(n8nApiKey, workflowJson);
            await n8n.activateWorkflow(n8nApiKey, workflowId);
            workflowIds[template.label.toLowerCase()] = workflowId;
        }

        // 10 & 11: Infrastructure setup complete (Awaiting Shopify Connection)
        onProgress("Infrastructure setup complete (Awaiting Shopify Connection)...");

        // 12: Final State Persistence
        onProgress("Finalizing tenant registration...");
        const passwordHash = await hashPassword(data.adminPassword);
        const rowIv = crypto.randomBytes(12).toString("base64");

        const tenant = await uow.tenants.upsert({
            id: tenantId,
            companyName: data.companyName,
            adminEmail: data.adminEmail,
            passwordHash,
            plan: data.plan ?? TenantPlan.FREE,
            shopDomain: data.shopDomain,
            hfSpaceName: spaceName,
            hfSpaceUrl: space.url,
            n8nBaseUrl: n8nBaseUrl,
            n8nIngestionWorkflowId: workflowIds['ingestion'],
            n8nChatWorkflowId: workflowIds['chat'],
            isActive: true
        });

        await uow.tenantN8n.upsert({
            tenantId: tenantId,
            neonConnectionStringEncrypted: Vault.encrypt(data.neonConnectionString, undefined, rowIv).ciphertext,
            hfTokenEncrypted: Vault.encrypt(data.hfToken, undefined, rowIv).ciphertext,
            n8nApiKeyEncrypted: Vault.encrypt(n8nApiKey, undefined, rowIv).ciphertext,
            n8nOwnerPasswordEncrypted: Vault.encrypt(n8nOwnerPassword, undefined, rowIv).ciphertext,
            openaiApiKeyEncrypted: Vault.encrypt(data.openaiApiKey, undefined, rowIv).ciphertext,
            shopifyWebhookSecretEncrypted: Vault.encrypt(shopifyWebhookSecret, undefined, rowIv).ciphertext,
            shopifyAppClientIdEncrypted: Vault.encrypt(data.shopifyAppClientId, undefined, rowIv).ciphertext,
            shopifyAppClientSecretEncrypted: Vault.encrypt(data.shopifyAppClientSecret, undefined, rowIv).ciphertext,
            n8nShopifyCredentialId: shopifyCredId,
            n8nOpenaiCredentialId: openaiCredId,
            iv: rowIv,
            containerStatus: "running"
        });

        onProgress("Onboarding complete!");
        return { tenantId, n8nBaseUrl };
    }
}
