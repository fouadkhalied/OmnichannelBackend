import { eq, and } from "drizzle-orm";
import { connectorCredentials, ConnectorCredential, NewConnectorCredential } from "../schema/connectorCredentials";
import { IPgCredentialRepository } from "./IPgCredentialRepository";

export class PgCredentialRepository implements IPgCredentialRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewConnectorCredential): Promise<void> {
        await this.db
            .insert(connectorCredentials)
            .values(input)
            .onConflictDoUpdate({
                target: [connectorCredentials.organizationId, connectorCredentials.storeId],
                set: {
                    shopDomain: input.shopDomain,
                    clientId: input.clientId,
                    apiVersion: input.apiVersion,
                    scopes: input.scopes,
                    encryptedCredentials: input.encryptedCredentials,
                    status: input.status,
                    updatedAt: new Date(),
                },
            });
    }

    async findByShopDomain(shopDomain: string): Promise<ConnectorCredential | null> {
        const [result] = await this.db
            .select()
            .from(connectorCredentials)
            .where(eq(connectorCredentials.shopDomain, shopDomain))
            .limit(1);
        return result || null;
    }

    async findByTenantId(organizationId: string): Promise<ConnectorCredential | null> {
        const [result] = await this.db
            .select()
            .from(connectorCredentials)
            .where(eq(connectorCredentials.organizationId, organizationId))
            .limit(1);
        return result || null;
    }

    async findByStoreId(storeId: string): Promise<ConnectorCredential | null> {
        const [result] = await this.db
            .select()
            .from(connectorCredentials)
            .where(eq(connectorCredentials.storeId, storeId))
            .limit(1);
        return result || null;
    }

    async markError(organizationId: string, storeId: string, error: string): Promise<void> {
        await this.db
            .update(connectorCredentials)
            .set({
                status: "error",
                errorMessage: error,
                updatedAt: new Date(),
            })
            .where(and(eq(connectorCredentials.organizationId, organizationId), eq(connectorCredentials.storeId, storeId)));
    }

    async markConnected(organizationId: string, storeId: string): Promise<void> {
        await this.db
            .update(connectorCredentials)
            .set({
                status: "active",
                errorMessage: null,
                updatedAt: new Date(),
            })
            .where(and(eq(connectorCredentials.organizationId, organizationId), eq(connectorCredentials.storeId, storeId)));
    }

    async updateLastWebhookAt(organizationId: string, storeId: string): Promise<void> {
        await this.db
            .update(connectorCredentials)
            .set({
                lastWebhookAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(eq(connectorCredentials.organizationId, organizationId), eq(connectorCredentials.storeId, storeId)));
    }
}
