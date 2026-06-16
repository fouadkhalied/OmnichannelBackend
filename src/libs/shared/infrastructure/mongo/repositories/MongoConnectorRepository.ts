import { logger } from "server/common/logger";
import { ConnectorModel, ConnectorCredentialModel } from "../models/index";
import { IConnectorRepository } from "src/modules/shopify/domain/repositories/IConnectorRepository";
import { ShopifyCredentials } from "src/modules/shopify/domain/repositories/IShopifyGraphQLClient";

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

/**
 * Decrypts connector credentials.
 * If CONNECTOR_ENCRYPTION_SECRET is set, uses AES-256-GCM decryption.
 * Otherwise treats stored value as plain JSON (dev mode).
 */
function decryptCredentials(encrypted: string): Record<string, unknown> {
    try {
        const secret = process.env.CONNECTOR_ENCRYPTION_SECRET;

        if (!secret) {
            // Dev mode — stored as plain JSON
            return JSON.parse(encrypted);
        }

        // Production — AES-256-GCM encrypted base64
        try {
            const crypto = require("crypto");
            const buffer = Buffer.from(encrypted, "base64");
            const iv = buffer.subarray(0, 12);
            const tag = buffer.subarray(12, 28);
            const ciphertext = buffer.subarray(28);

            const key = crypto.scryptSync(secret, "shopify-connector-salt", 32);
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(tag);

            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return JSON.parse(decrypted.toString("utf8"));
        } catch (aesError) {
            // Fallback: If decryption fails, see if it was stored as plain JSON in the test db
            try {
                return JSON.parse(encrypted);
            } catch (jsonError) {
                throw aesError; // If it's not valid JSON, throw the original crypto error
            }
        }
    } catch (error) {
        logger.error("MongoConnectorRepository.decryptCredentials.failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        throw new Error("Failed to decrypt connector credentials");
    }
}

export class MongoConnectorRepository implements IConnectorRepository {
    async getCredentials(tenantId: string): Promise<ShopifyCredentials> {
        const { organizationId, storeId } = splitTenantId(tenantId);

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

        const decrypted = decryptCredentials(credentialDoc.encryptedCredentials);

        const accessToken = String(decrypted.accessToken ?? "").trim();
        const shopDomain = String(decrypted.shopDomain ?? decrypted.shopUrl ?? credentialDoc.shopDomain ?? "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
        const apiVersion = String(decrypted.apiVersion ?? "2025-01").trim() || "2025-01";

        if (!accessToken || !shopDomain) {
            throw new Error(
                `Shopify credentials incomplete for tenant ${tenantId}: missing accessToken or shopDomain`
            );
        }

        return { accessToken, shopDomain, apiVersion };
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