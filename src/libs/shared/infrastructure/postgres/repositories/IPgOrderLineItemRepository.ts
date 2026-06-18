import { OrderLineItem, NewOrderLineItem } from "../schema/orderLineItems";

export interface IPgOrderLineItemRepository {
    upsert(input: NewOrderLineItem): Promise<void>;
    deleteByOrder(orderId: string): Promise<void>;
}
