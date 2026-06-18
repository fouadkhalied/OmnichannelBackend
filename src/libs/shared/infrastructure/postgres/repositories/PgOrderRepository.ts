import { eq, and } from "drizzle-orm";
import { orders, Order, NewOrder } from "../schema/orders";
import { IPgOrderRepository } from "./IPgOrderRepository";

export class PgOrderRepository implements IPgOrderRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewOrder): Promise<Order> {
        const [result] = await this.db
            .insert(orders)
            .values(input)
            .onConflictDoUpdate({
                target: [orders.storeId, orders.shopifyId],
                set: {
                    orderNumber: input.orderNumber,
                    customerId: input.customerId,
                    shopifyCustomerId: input.shopifyCustomerId,
                    email: input.email,
                    phone: input.phone,
                    financialStatus: input.financialStatus,
                    fulfillmentStatus: input.fulfillmentStatus,
                    cancelledAt: input.cancelledAt,
                    cancelReason: input.cancelReason,
                    totalPrice: input.totalPrice,
                    subtotalPrice: input.subtotalPrice,
                    totalTax: input.totalTax,
                    currency: input.currency,
                    data: input.data,
                    updatedAt: new Date(),
                    shopifyUpdatedAt: input.shopifyUpdatedAt,
                },
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<Order | null> {
        const [result] = await this.db
            .select()
            .from(orders)
            .where(eq(orders.id, id))
            .limit(1);
        return result || null;
    }

    async findByShopifyId(storeId: string, shopifyId: string): Promise<Order | null> {
        const [result] = await this.db
            .select()
            .from(orders)
            .where(and(eq(orders.storeId, storeId), eq(orders.shopifyId, shopifyId)))
            .limit(1);
        return result || null;
    }
}
