import { eq, and } from "drizzle-orm";
import { logger } from "../../../../../libs/common/logger";
import { connectorCredentials, ConnectorCredential } from "../schema/connectorCredentials";
import {
    IConnectorRepository,
    ConnectorIdentity,
    UpsertCredentialsInput,
} from "src/modules/shopify/domain/repositories/IConnectorRepository";
import { ShopifyCredentials } from "src/modules/shopify/domain/repositories/IShopifyGraphQLClient";
import { Vault } from "../../../crypto/vault";

function splitTenantId(tenantId: string): { organizationId: string; storeId: string } {
    if (tenantId.includes(":")) {
        const [organizationId, storeId] = tenantId.split(":");
        return { organizationId, storeId };
    }
    return { organizationId: tenantId, storeId: tenantId };
}

export class PgConnectorRepository implements IConnectorRepository {
    private readonly secret = process.env.CONNECTOR_ENCRYPTION_SECRET;

    constructor(private readonly db: any) { }

    async getCredentials(tenantId: string): Promise<ShopifyCredentials> {
        const { organizationId, storeId } = splitTenantId(tenantId);

        const [row] = await this.db
            .select()
            .from(connectorCredentials)
            .where(
                and(
                    eq(connectorCredentials.organizationId, organizationId as any),
                    eq(connectorCredentials.storeId, storeId as any)
                )
            )
            .limit(1);

        if (!row) {
            throw new Error(`Shopify credentials not found for tenant ${tenantId}.`);
        }

        let decrypted: any;
        try {
            const raw = Vault.decrypt(row.encryptedCredentials);
            decrypted = JSON.parse(raw);
        } catch (error) {
            logger.error("credentials.decryption_failed", {
                tenantId,
                shopDomain: row.shopDomain,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`Failed to decrypt credentials for tenant ${tenantId}. The data might be in a legacy format or the encryption key is incorrect.`);
        }

        return {
            accessToken: String(decrypted.accessToken || "").trim(),
            shopDomain: row.shopDomain,
            apiVersion: row.apiVersion,
            clientId: row.clientId,
            clientSecret: String(decrypted.clientSecret || "").trim(),
        };
    }

    async findByShopDomain(shopDomain: string): Promise<ConnectorIdentity | null> {
        const [row] = await this.db
            .select()
            .from(connectorCredentials)
            .where(eq(connectorCredentials.shopDomain, shopDomain))
            .limit(1);

        if (!row) return null;

        return {
            organizationId: row.organizationId,
            storeId: row.storeId,
            tenantId: `${row.organizationId}:${row.storeId}`,
        };
    }

    async getWebhookSecret(tenantId: string): Promise<string> {
        const { organizationId, storeId } = splitTenantId(tenantId);

        const [row] = await this.db
            .select()
            .from(connectorCredentials)
            .where(
                and(
                    eq(connectorCredentials.organizationId, organizationId as any),
                    eq(connectorCredentials.storeId, storeId as any)
                )
            )
            .limit(1);

        if (!row) {
            throw new Error(`Webhook secret not found for tenant ${tenantId}`);
        }

        let decrypted: any;
        try {
            const raw = Vault.decrypt(row.encryptedCredentials);
            decrypted = JSON.parse(raw);
        } catch (error) {
            logger.error("webhook.secret_decryption_failed", {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`Failed to decrypt webhook secret for tenant ${tenantId}.`);
        }

        if (!decrypted.webhookSecret) {
            throw new Error(`Webhook secret missing in credentials for tenant ${tenantId}`);
        }

        return String(decrypted.webhookSecret || "");
    }

    async upsertCredentials(input: UpsertCredentialsInput): Promise<void> {
        const encrypted = Vault.encrypt(
            JSON.stringify({
                accessToken: input.accessToken,
                shopDomain: input.shopDomain,
                clientId: input.clientId,
                clientSecret: input.clientSecret,
                apiVersion: input.apiVersion,
                scopes: input.scopes,
                webhookSecret: input.webhookSecret,
            })
        );

        await this.db
            .insert(connectorCredentials)
            .values({
                organizationId: input.organizationId as any,
                storeId: input.storeId as any,
                shopDomain: input.shopDomain,
                provider: "shopify",
                clientId: input.clientId,
                apiVersion: input.apiVersion,
                scopes: input.scopes,
                encryptedCredentials: encrypted,
                status: "active",
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [connectorCredentials.organizationId, connectorCredentials.storeId],
                set: {
                    shopDomain: input.shopDomain,
                    clientId: input.clientId,
                    apiVersion: input.apiVersion,
                    scopes: input.scopes,
                    encryptedCredentials: encrypted,
                    status: "active",
                    updatedAt: new Date(),
                },
            });
    }

    async markConnected(tenantId: string, shopDomain: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);
        await this.db
            .update(connectorCredentials)
            .set({ status: "active", updatedAt: new Date() })
            .where(
                and(
                    eq(connectorCredentials.organizationId, organizationId as any),
                    eq(connectorCredentials.storeId, storeId as any)
                )
            );
    }

    async markError(tenantId: string, error: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);
        await this.db
            .update(connectorCredentials)
            .set({ status: "error", errorMessage: error, updatedAt: new Date() })
            .where(
                and(
                    eq(connectorCredentials.organizationId, organizationId as any),
                    eq(connectorCredentials.storeId, storeId as any)
                )
            );
    }

    async updateLastSyncAt(tenantId: string): Promise<void> {
        const { organizationId, storeId } = splitTenantId(tenantId);
        await this.db
            .update(connectorCredentials)
            .set({ lastSyncAt: new Date(), updatedAt: new Date() })
            .where(
                and(
                    eq(connectorCredentials.organizationId, organizationId as any),
                    eq(connectorCredentials.storeId, storeId as any)
                )
            );
    }
}
