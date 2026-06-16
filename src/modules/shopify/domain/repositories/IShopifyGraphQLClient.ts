import { ShopifyProduct } from "../entities/ShopifyProduct";
import { ShopifyCustomer } from "../entities/ShopifyCustomer";
import { ShopifyOrder } from "../entities/ShopifyOrder";

export type ShopifyCredentials = {
    accessToken: string;
    shopDomain: string;
    apiVersion: string;
};

export type GraphQLPage<T> = {
    items: T[];
    nextCursor: string | null;
    hasNextPage: boolean;
};

export interface IShopifyGraphQLClient {
    fetchProducts(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyProduct>>;

    fetchCustomers(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyCustomer>>;

    fetchOrders(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyOrder>>;

    fetchProductById(input: {
        credentials: ShopifyCredentials;
        externalId: string;
    }): Promise<ShopifyProduct | null>;

    fetchCustomerById(input: {
        credentials: ShopifyCredentials;
        externalId: string;
    }): Promise<ShopifyCustomer | null>;

    fetchOrderById(input: {
        credentials: ShopifyCredentials;
        externalId: string;
    }): Promise<ShopifyOrder | null>;
}
