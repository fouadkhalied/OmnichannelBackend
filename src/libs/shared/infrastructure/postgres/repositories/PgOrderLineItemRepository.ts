import { eq } from "drizzle-orm";
import { orderLineItems, NewOrderLineItem } from "../schema/orderLineItems";
import { IPgOrderLineItemRepository } from "./IPgOrderLineItemRepository";

export class PgOrderLineItemRepository implements IPgOrderLineItemRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewOrderLineItem): Promise<void> {
        await this.db
            .insert(orderLineItems)
            .values(input)
            .onConflictDoUpdate({
                target: [orderLineItems.storeId, orderLineItems.shopifyId],
                set: {
                    title: input.title,
                    variantId: input.variantId,
                    productId: input.productId,
                    sku: input.sku,
                    quantity: input.quantity,
                    price: input.price,
                    data: input.data,
                    updatedAt: new Date(),
                },
            });
    }

    async deleteByOrder(orderId: string): Promise<void> {
        await this.db
            .delete(orderLineItems)
            .where(eq(orderLineItems.orderId, orderId));
    }
}
