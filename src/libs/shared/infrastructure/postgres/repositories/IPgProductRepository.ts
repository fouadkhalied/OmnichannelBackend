import { Product, NewProduct } from "../schema/products";

export interface IPgProductRepository {
    upsert(input: NewProduct): Promise<Product>;
    findById(id: string): Promise<Product | null>;
    findByShopifyId(storeId: string, shopifyId: string): Promise<Product | null>;
}
