export class ShopifyVariant {
    constructor(
        public readonly id: string,
        public readonly externalId: string,
        public readonly productExternalId: string,
        public readonly tenantId: string,
        public readonly title: string,
        public readonly sku: string | null,
        public readonly price: string,
        public readonly compareAtPrice: string | null,
        public readonly inventoryQuantity: number,
        public readonly inventoryItemId: string | null,
        public readonly updatedAt: Date
    ) { }
}
