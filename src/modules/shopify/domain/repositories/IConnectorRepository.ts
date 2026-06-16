import { ShopifyCredentials } from "./IShopifyGraphQLClient";

export interface IConnectorRepository {
    getCredentials(tenantId: string): Promise<ShopifyCredentials>;
    updateLastSyncAt(tenantId: string): Promise<void>;
}
