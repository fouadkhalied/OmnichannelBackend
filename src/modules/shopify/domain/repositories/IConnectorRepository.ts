import { ShopifyCredentials } from "./IShopifyGraphQLClient";

export type ConnectorIdentity = {
    organizationId: string;
    storeId: string;
    tenantId: string; // organizationId:storeId
};

export type UpsertCredentialsInput = {
    organizationId: string;
    storeId: string;
    shopDomain: string;
    accessToken: string;
    apiVersion: string;
    webhookSecret: string;
    scopes: string;
};

export interface IConnectorRepository {
    // ── Existing ─────────────────────────────────────────────────────────────
    getCredentials(tenantId: string): Promise<ShopifyCredentials>;
    updateLastSyncAt(tenantId: string): Promise<void>;

    // ── New ───────────────────────────────────────────────────────────────────
    /** Looks up connector identity by shopDomain (for webhook tenant resolution). */
    findByShopDomain(shopDomain: string): Promise<ConnectorIdentity | null>;

    /** Returns the per-store webhook HMAC secret for a given tenant. */
    getWebhookSecret(tenantId: string): Promise<string>;

    /** Creates/updates both ConnectorModel and ConnectorCredentialModel atomically. */
    upsertCredentials(input: UpsertCredentialsInput): Promise<void>;

    /** Marks the connector as connected after successful OAuth. */
    markConnected(tenantId: string, shopDomain: string): Promise<void>;

    /** Marks the connector as error state. */
    markError(tenantId: string, error: string): Promise<void>;
}
