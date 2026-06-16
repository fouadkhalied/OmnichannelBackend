export class ShopifyCustomer {
    constructor(
        public readonly id: string,
        public readonly externalId: string,
        public readonly tenantId: string,
        public readonly firstName: string | null,
        public readonly lastName: string | null,
        public readonly email: string | null,
        public readonly phone: string | null,
        public readonly ordersCount: number,
        public readonly totalSpent: string,
        public readonly tags: string[],
        public readonly updatedAt: Date
    ) { }
}
