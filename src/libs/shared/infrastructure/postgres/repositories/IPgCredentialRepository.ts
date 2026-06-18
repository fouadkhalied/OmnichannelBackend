import { ConnectorCredential, NewConnectorCredential } from "../schema/connectorCredentials";

export interface IPgCredentialRepository {
    upsert(input: NewConnectorCredential): Promise<void>;
    findByShopDomain(shopDomain: string): Promise<ConnectorCredential | null>;
    findByTenantId(organizationId: string): Promise<ConnectorCredential | null>;
    markError(organizationId: string, storeId: string, error: string): Promise<void>;
    markConnected(organizationId: string, storeId: string): Promise<void>;
    updateLastWebhookAt(organizationId: string, storeId: string): Promise<void>;
}
