import fs from "fs";
import path from "path";
import { logger } from "../../../../../libs/common/logger";
import { ShopifyProduct } from "../../../domain/entities/ShopifyProduct";
import { GraphQLPage, IShopifyGraphQLClient, ShopifyCredentials } from "../../../domain/repositories/IShopifyGraphQLClient";
import { ProductMapper } from "./mappers/ProductMapper";
import { ShopifyOrder } from "../../../domain/entities/ShopifyOrder";
import { OrderMapper } from "./mappers/OrderMapper";
import { CustomerMapper } from "./mappers/CustomerMapper";
import { ShopifyCustomer } from "../../../domain/entities/ShopifyCustomer";



export class InsufficientScopeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InsufficientScopeError";
    }
}

export class ShopifyGraphQLClient implements IShopifyGraphQLClient {
    private readonly queries: Record<string, string> = {};

    constructor() {
        this.loadQueries();
    }

    private loadQueries() {
        const queryFiles = {
            getProducts: "getProducts.graphql",
            getCustomers: "getCustomers.graphql",
            getOrders: "getOrders.graphql",
        };

        for (const [key, filename] of Object.entries(queryFiles)) {
            const filePath = path.join(__dirname, "queries", filename);
            this.queries[key] = fs.readFileSync(filePath, "utf8");
        }
    }

    private async request(
        queryName: string,
        variables: any,
        credentials: ShopifyCredentials
    ): Promise<any> {
        const url = `https://${credentials.shopDomain}/admin/api/${credentials.apiVersion}/graphql.json`;
        const headers = {
            "X-Shopify-Access-Token": credentials.accessToken,
            "Content-Type": "application/json",
        };

        const query = this.queries[queryName] || queryName; // fallback to literal query if not a key

        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            attempts++;
            const start = Date.now();
            // TO (fetch version)
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ query, variables }),
                });
                const duration = Date.now() - start;

                if (response.status === 429) {
                    logger.warn(`Shopify rate limit hit (429), retry ${attempts}/${maxAttempts}`, { shop: credentials.shopDomain });
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
                    continue;
                }

                if (response.status === 403) {
                    throw new InsufficientScopeError(`Insufficient scope for ${queryName}`);
                }

                if (response.status >= 500) {
                    logger.error(`Shopify server error (${response.status}), retry ${attempts}/${maxAttempts}`, { shop: credentials.shopDomain });
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`Unexpected Shopify response: ${response.status}`);
                }

                const json = await response.json() as any;
                logger.info(`ShopifyGraphQL request ${queryName}`, { duration, shop: credentials.shopDomain });

                if (json.errors) {
                    throw new Error(json.errors[0]?.message || "GraphQL Error");
                }

                const callLimit = response.headers.get("x-shopify-shop-api-call-limit");
                if (callLimit) {
                    const [used, total] = callLimit.split("/").map(Number);
                    if (used / total > 0.9) {
                        logger.warn("Shopify API rate limit near threshold", { used, total, shop: credentials.shopDomain });
                        await new Promise((r) => setTimeout(r, 500));
                    }
                }

                return json.data;

            } catch (error: any) {
                if (error instanceof InsufficientScopeError) throw error;
                if (error.name === "TypeError") {
                    // fetch throws TypeError on network failure (DNS, connection refused, timeout)
                    logger.error(`ShopifyGraphQL network error ${queryName}`, { error: error.message, shop: credentials.shopDomain });
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
                    continue;
                }
                logger.error(`ShopifyGraphQL request failed ${queryName}`, { error: error.message, shop: credentials.shopDomain });
                throw error;
            }
        }

        throw new Error("Max retry attempts reached for Shopify GraphQL request");
    }

    async fetchProducts(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyProduct>> {
        const data = await this.request("getProducts", { first: input.pageSize, after: input.cursor }, input.credentials);
        const products = data.products;
        return {
            items: products.edges.map((edge: any) => ProductMapper.toDomain(edge.node, input.credentials.shopDomain)), // Using shopDomain as tenantId for now, but usually they are related
            nextCursor: products.pageInfo.endCursor,
            hasNextPage: products.pageInfo.hasNextPage,
        };
    }

    async fetchCustomers(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyCustomer>> {
        const data = await this.request("getCustomers", { first: input.pageSize, after: input.cursor }, input.credentials);
        const customers = data.customers;
        return {
            items: customers.edges.map((edge: any) => CustomerMapper.toDomain(edge.node, input.credentials.shopDomain)),
            nextCursor: customers.pageInfo.endCursor,
            hasNextPage: customers.pageInfo.hasNextPage,
        };
    }

    async fetchOrders(input: {
        credentials: ShopifyCredentials;
        cursor: string | null;
        pageSize: number;
    }): Promise<GraphQLPage<ShopifyOrder>> {
        const data = await this.request("getOrders", { first: input.pageSize, after: input.cursor }, input.credentials);
        const orders = data.orders;
        return {
            items: orders.edges.map((edge: any) => OrderMapper.toDomain(edge.node, input.credentials.shopDomain)),
            nextCursor: orders.pageInfo.endCursor,
            hasNextPage: orders.pageInfo.hasNextPage,
        };
    }

    // ID-based fetches (single item)
    // We can use the same queries but filter or create new queries.
    // For simplicity and completeness, I'll use inline simple queries for single items.

    async fetchProductById(input: { credentials: ShopifyCredentials; externalId: string }): Promise<ShopifyProduct | null> {
        const gid = `gid://shopify/Product/${input.externalId}`;
        const query = `
          query GetProduct($id: ID!) {
            product(id: $id) {
              id title handle vendor productType status descriptionHtml tags updatedAt createdAt
              featuredImage { id url altText width height }
              images(first: 20) { edges { node { id url altText width height } } }
              variants(first: 100) { edges { node { id title sku price compareAtPrice updatedAt inventoryQuantity inventoryItem { id } } } }
            }
          }
        `;
        const data = await this.request(query, { id: gid }, input.credentials);
        return data.product ? ProductMapper.toDomain(data.product, input.credentials.shopDomain) : null;
    }

    async fetchCustomerById(input: { credentials: ShopifyCredentials; externalId: string }): Promise<ShopifyCustomer | null> {
        const gid = `gid://shopify/Customer/${input.externalId}`;
        const query = `
          query GetCustomer($id: ID!) {
            customer(id: $id) {
              id firstName lastName email phone numberOfOrders amountSpent { amount currencyCode } tags updatedAt createdAt
            }
          }
        `;
        const data = await this.request(query, { id: gid }, input.credentials);
        return data.customer ? CustomerMapper.toDomain(data.customer, input.credentials.shopDomain) : null;
    }

    async fetchOrderById(input: { credentials: ShopifyCredentials; externalId: string }): Promise<ShopifyOrder | null> {
        const gid = `gid://shopify/Order/${input.externalId}`;
        const query = `
          query GetOrder($id: ID!) {
            order(id: $id) {
              id name displayFinancialStatus displayFulfillmentStatus currencyCode
              totalPriceSet { shopMoney { amount currencyCode } }
              customer { id }
              lineItems(first: 20) { edges { node { title quantity originalUnitPriceSet { shopMoney { amount } } } } }
              updatedAt createdAt
            }
          }
        `;
        const data = await this.request(query, { id: gid }, input.credentials);
        return data.order ? OrderMapper.toDomain(data.order, input.credentials.shopDomain) : null;
    }
}
