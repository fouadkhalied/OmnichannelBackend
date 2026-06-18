import { logger } from "../../../../../libs/common/logger";
import { ConnectorModel, ConnectorCredentialModel } from "../models/index";
import {
    IConnectorRepository,
    ConnectorIdentity,
    UpsertCredentialsInput,
} from "src/modules/shopify/domain/repositories/IConnectorRepository";
import { ShopifyCredentials } from "src/modules/shopify/domain/repositories/IShopifyGraphQLClient";
import { decryptCredentials, encryptCredentials } from "../../../crypto/encrypt";
import crypto from "crypto";

/**
 * Splits tenantId into organizationId and storeId.
 * Format expected: "organizationId:storeId"
 */
function splitTenantId(tenantId: string): { organizationId: string; storeId: string } {
    if (tenantId.includes(":")) {
        const [organizationId, storeId] = tenantId.split(":");
        return { organizationId, storeId };
    }
    return { organizationId: tenantId, storeId: tenantId };
}

export class MongoConnectorRepository implements IConnectorRepository {
    private readonly secret = process.env.CONNECTOR_ENCRYPTION_SECRET;

    async getCredentials(tenantId: string): Promise<ShopifyCredentials> {
        const { organizationId, storeId } = splitTenantId(tenantId);

        // 1. Try Postgres first (Migration target)
        try {
            const { requireDb } = await import("../../../infrastructure/postgres/PgClient");
            const { PgCredentialRepository } = await import("../../../infrastructure/postgres/repositories/PgCredentialRepository");

            const pgRepo = new PgCredentialRepository(requireDb());
            const pgDoc = await pgRepo.findByTenantId(organizationId);

            if (pgDoc && pgDoc.status === "active") {
                const decrypted = decryptCredentials(pgDoc.encryptedCredentials, this.secret);
                return {
                    accessToken: String(decrypted.accessToken || "").trim(),
                    shopDomain: pgDoc.shopDomain,
                    apiVersion: pgDoc.apiVersion,
                    clientId: pgDoc.clientId,
                    clientSecret: String(decrypted.clientSecret || "").trim(),
                };
            }
        } catch (error) {
            logger.warn("MongoConnectorRepository.getCredentials.pg_failed", { tenantId, error });
        }

        // 2. Fallback to Mongo (Legacy)
        const credentialDoc = await ConnectorCredentialModel.findOne({
            organizationId,
            storeId,
            provider: "shopify",
        })
            .sort({ updatedAt: -1 })
            .lean();

        if (!credentialDoc) {
            throw new Error(
                `Shopify credentials not found for tenant ${tenantId}. Please connect Shopify first.`
            );
        }

        const decrypted = decryptCredentials(credentialDoc.encryptedCredentials, this.secret);

        const accessToken = String(decrypted.accessToken ?? "").trim();
        const shopDomain = String(
            decrypted.shopDomain ?? decrypted.shopUrl ?? credentialDoc.shopDomain ?? ""
        )
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
        const apiVersion = String(decrypted.apiVersion ?? "2025-01").trim() || "2025-01";
        const clientId = String(decrypted.clientId ?? "").trim();
        const clientSecret = String(decrypted.clientSecret ?? "").trim();

        if (!accessToken || !shopDomain || !clientId || !clientSecret) {
            throw new Error(
                `Shopify credentials incomplete for tenant ${tenantId}: missing accessToken, shopDomain, clientId, or clientSecret`
            );
        }

        return { accessToken, shopDomain, apiVersion, clientId, clientSecret };
    }

    async findByShopDomain(shopDomain: string): Promise<ConnectorIdentity | null> {
        const doc = await ConnectorCredentialModel.findOne({
            provider: "shopify",
            shopDomain,
        })
            .sort({ updatedAt: -1 })
            .lean();

        if (!doc) return null;

        return {
            organizationId: doc.organizationId,
            storeId: doc.storeId,
            tenantId: `${doc.organizationId}:${doc.storeId}`,
        };
    }

    async getWebhookSecret(tenantId: string): Promise<string> {
        const { organizationId, storeId } = splitTenantId(tenantId);

        const doc = await ConnectorCredentialModel.findOne({
            organizationId,
            storeId,
            provider: "shopify",
        }).lean();

        if (!doc?.webhookSecret) {
            throw new Error(`Webhook secret not found for tenant ${tenantId}`);
        }

        return doc.webhookSecret;
    }

    async upsertCredentials(input: UpsertCredentialsInput): Promise<void> {
        const encrypted = encryptCredentials(
            JSON.stringify({
                accessToken: input.accessToken,
                shopDomain: input.shopDomain,
                clientId: input.clientId,
                clientSecret: input.clientSecret,
                apiVersion: input.apiVersion,
                scopes: input.scopes,
                webhookSecret: input.webhookSecret,
            }),
            this.secret!
        );

        // 1. Dual-write to Mongo (Legacy)
        // Ensure Connector exists
        await ConnectorModel.updateOne(
            {
                organizationId: input.organizationId,
                storeId: input.storeId,
                provider: "shopify",
            },
            {
                $set: {
                    status: "connected",
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    id: crypto.randomUUID(),
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        // Upsert Credentials
        await ConnectorCredentialModel.updateOne(
            {
                organizationId: input.organizationId,
                storeId: input.storeId,
                provider: "shopify",
            },
            {
                $set: {
                    shopDomain: input.shopDomain,
                    encryptedCredentials: encrypted,
                    webhookSecret: input.webhookSecret,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    connectorId: crypto.randomUUID(), // Use uuid for connectorId unique index requirement
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        // 2. Dual-write to Postgres (Migration Target)
        try {
            const { requireDb } = await import("../../../infrastructure/postgres/PgClient");
            const { PgCredentialRepository } = await import("../../../infrastructure/postgres/repositories/PgCredentialRepository");

            const pgRepo = new PgCredentialRepository(requireDb());
            await pgRepo.upsert({
                organizationId: input.organizationId,
                storeId: input.storeId,
                shopDomain: input.shopDomain,
                provider: "shopify",
                clientId: input.clientId,
                apiVersion: input.apiVersion,
                scopes: input.scopes,
                encryptedCredentials: encrypted,
                status: "active",
            });
            logger.info("MongoConnectorRepository.upsertCredentials.pg_success", {
                organizationId: input.organizationId,
                storeId: input.storeId
            });
        } catch (error) {
            logger.error("MongoConnectorRepository.upsertCredentials.pg_failed", {
                organizationId: input.organizationId,
                storeId: input.storeId,
                error
            });
            // We don't throw here to keep Mongo working even if PG fails during migration phase
        }
    }

    async markConnected(tenantId: string, shopDomain: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);
        await ConnectorModel.updateOne(
            { organizationId, storeId, provider: "shopify" },
            { $set: { status: "connected", updatedAt: new Date() } }
        );
    }

    async markError(tenantId: string, error: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);
        await ConnectorModel.updateOne(
            { organizationId, storeId, provider: "shopify" },
            { $set: { status: "error", lastError: error, updatedAt: new Date() } }
        );
    }

    async updateLastSyncAt(tenantId: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);

        await ConnectorModel.updateOne(
            { organizationId, storeId, provider: "shopify" },
            {
                $set: {
                    status: "connected",
                    lastSyncAt: new Date(),
                    lastError: null,
                    updatedAt: new Date(),
                },
            }
        );
    }
}
