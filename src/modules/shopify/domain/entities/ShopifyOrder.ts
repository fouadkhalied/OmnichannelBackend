export interface ShopifyLineItem {
    title: string;
    quantity: number;
    price: string;
}

export class ShopifyOrder {
    constructor(
        public readonly id: string,
        public readonly externalId: string,
        public readonly tenantId: string,
        public readonly name: string,
        public readonly financialStatus: string | null,
        public readonly fulfillmentStatus: string | null,
        public readonly currency: string,
        public readonly totalPrice: string,
        public readonly customerId: string | null,
        public readonly lineItems: ShopifyLineItem[],
        public readonly updatedAt: Date
    ) { }
}
