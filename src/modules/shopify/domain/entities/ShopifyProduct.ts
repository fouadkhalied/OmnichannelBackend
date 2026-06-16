import { ShopifyVariant } from "./ShopifyVariant";

export interface ShopifyImage {
    id: string;
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
    variantIds: string[];
}

export class ShopifyProduct {
    constructor(
        public readonly id: string,
        public readonly externalId: string,
        public readonly tenantId: string,
        public readonly title: string,
        public readonly handle: string,
        public readonly vendor: string,
        public readonly productType: string,
        public readonly status: string,
        public readonly bodyHtml: string | null,
        public readonly tags: string[],
        public readonly images: ShopifyImage[],
        public readonly variants: ShopifyVariant[],
        public readonly updatedAt: Date,
        public readonly createdAt: Date
    ) { }
}
