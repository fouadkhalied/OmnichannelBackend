import { eq, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema/index";
import { IPgProductRepository } from "./IPgProductRepository";
import { products, Product, NewProduct } from "../schema/products";

export class PgProductRepository implements IPgProductRepository {
    constructor(private readonly db: any) { } // can be db or tx

    async upsert(input: NewProduct): Promise<Product> {
        const [result] = await this.db
            .insert(products)
            .values(input)
            .onConflictDoUpdate({
                target: [products.storeId, products.shopifyId],
                set: {
                    handle: input.handle,
                    title: input.title,
                    vendor: input.vendor,
                    productType: input.productType,
                    status: input.status,
                    descriptionHtml: input.descriptionHtml,
                    tags: input.tags,
                    data: input.data,
                    contentHash: input.contentHash,
                    embeddingStatus: input.embeddingStatus,
                    updatedAt: new Date(),
                    shopifyUpdatedAt: input.shopifyUpdatedAt,
                },
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<Product | null> {
        const [result] = await this.db
            .select()
            .from(products)
            .where(eq(products.id, id))
            .limit(1);
        return result || null;
    }

    async findByShopifyId(storeId: string, shopifyId: string): Promise<Product | null> {
        const [result] = await this.db
            .select()
            .from(products)
            .where(and(eq(products.storeId, storeId), eq(products.shopifyId, shopifyId)))
            .limit(1);
        return result || null;
    }
}
