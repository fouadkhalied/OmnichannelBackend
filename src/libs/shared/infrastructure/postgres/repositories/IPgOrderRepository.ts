import { Order, NewOrder } from "../schema/orders";

export interface IPgOrderRepository {
    upsert(input: NewOrder): Promise<Order>;
    findById(id: string): Promise<Order | null>;
    findByShopifyId(storeId: string, shopifyId: string): Promise<Order | null>;
}
