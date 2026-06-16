export type ShopifyEntityTypeValues = "product" | "variant" | "inventory" | "customer" | "order";

export class ShopifyEntityType {
    constructor(private readonly value: ShopifyEntityTypeValues) { }

    getValue(): ShopifyEntityTypeValues {
        return this.value;
    }

    requiresImageEnrichment(): boolean {
        return this.value === "product";
    }

    getParentType(): ShopifyEntityTypeValues | null {
        switch (this.value) {
            case "variant": return "product";
            case "inventory": return "variant";
            default: return null;
        }
    }

    static fromString(type: string): ShopifyEntityType {
        const valid: ShopifyEntityTypeValues[] = ["product", "variant", "inventory", "customer", "order"];
        if (!valid.includes(type as any)) {
            throw new Error(`Invalid Shopify entity type: ${type}`);
        }
        return new ShopifyEntityType(type as ShopifyEntityTypeValues);
    }
}
