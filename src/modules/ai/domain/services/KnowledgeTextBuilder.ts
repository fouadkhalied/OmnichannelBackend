import { KnowledgeMetadata } from "../entities/KnowledgeDocument";

export type KnowledgeTextResult = {
    title: string;
    text: string;
    productAvailability: boolean;
    customerId: string | null;
    sourceType: string;
    language: string;
    metadata: Partial<KnowledgeMetadata>;
};

export class KnowledgeTextBuilder {
    private static stripHtml(html: string): string {
        return html.replace(/<[^>]*>?/gm, "").trim();
    }

    static build(entityType: string, payload: any): KnowledgeTextResult {
        switch (entityType) {
            case "product":
                return this.buildProductText(payload);
            case "customer":
                return this.buildCustomerText(payload);
            case "order":
                return this.buildOrderText(payload);
            case "variant":
                return this.buildVariantText(payload);
            default:
                throw new Error(`Unsupported entity type for text building: ${entityType}`);
        }
    }

    private static buildProductText(payload: any): KnowledgeTextResult {
        const title = payload.title || "Untitled Product";
        const bodyHtml = payload.bodyHtml || "";
        const description = this.stripHtml(bodyHtml);
        const imageCount = payload.images?.length || 0;
        const primaryImageUrl = payload.images?.[0]?.url || null;
        const visualDescriptors = payload.visualDescriptors || [];

        let text = `Shopify product data\n`;
        text += `Title: ${title}\n`;
        text += `Handle: ${payload.handle || ""}\n`;
        text += `Vendor: ${payload.vendor || ""}\n`;
        text += `Type: ${payload.productType || ""}\n`;
        text += `Status: ${payload.status || ""}\n`;
        text += `Description: ${description}\n`;
        text += `Primary image: ${primaryImageUrl || ""}\n`;
        text += `Image count: ${imageCount}\n`;

        if (visualDescriptors.length > 0) {
            text += `Visual search descriptors: ${visualDescriptors.join(", ")}\n`;
        }

        if (payload.images?.length > 0) {
            text += `Image URLs:\n`;
            payload.images.forEach((img: any, i: number) => {
                text += `- Image ${i + 1}: ${img.url}, Alt: ${img.altText || ""}, Size: ${img.width || 0}x${img.height || 0}\n`;
            });
        }

        if (payload.variants?.length > 0) {
            text += `Variants:\n`;
            payload.variants.forEach((v: any) => {
                text += `- Variant: ${v.title}, SKU: ${v.sku || ""}, Price: ${v.price || 0}, Inventory: ${v.inventoryQuantity || 0}\n`;
            });
        }

        const available = payload.variants?.some((v: any) => v.inventoryQuantity > 0) || false;

        return {
            title,
            text,
            productAvailability: available,
            customerId: null,
            sourceType: "product",
            language: "en",
            metadata: {
                imageCount,
                primaryImageUrl,
                imageUrls: payload.images?.map((img: any) => img.url),
                visualDescriptors,
                productAvailability: available,
            }
        };
    }

    private static buildCustomerText(payload: any): KnowledgeTextResult {
        const title = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || payload.email || "Unnamed Customer";
        let text = `Shopify customer profile\n`;
        text += `Name: ${payload.firstName || ""} ${payload.lastName || ""}\n`;
        text += `Email: ${payload.email || ""}\n`;
        text += `Phone: ${payload.phone || ""}\n`;
        text += `Orders count: ${payload.ordersCount || 0}\n`;
        text += `Total spent: ${payload.totalSpent || 0}\n`;
        text += `Tags: ${payload.tags?.join(", ") || ""}\n`;

        return {
            title,
            text,
            productAvailability: false,
            customerId: payload.id,
            sourceType: "customer",
            language: "en",
            metadata: {
                customerId: payload.id
            }
        };
    }

    private static buildOrderText(payload: any): KnowledgeTextResult {
        const title = payload.name || "Order";
        let text = `Shopify order record\n`;
        text += `Order name: ${payload.name || ""}\n`;
        text += `Financial status: ${payload.financialStatus || ""}\n`;
        text += `Fulfillment status: ${payload.fulfillmentStatus || ""}\n`;
        text += `Currency: ${payload.currencyCode || payload.currency || ""}\n`;
        text += `Total price: ${payload.totalPrice || 0}\n`;
        text += `Customer ID: ${payload.customerId || ""}\n`;

        if (payload.lineItems?.length > 0) {
            text += `Line items:\n`;
            payload.lineItems.forEach((item: any) => {
                text += `- ${item.title} x${item.quantity}\n`;
            });
        }

        return {
            title,
            text,
            productAvailability: false,
            customerId: payload.customerId || null,
            sourceType: "order",
            language: "en",
            metadata: {
                customerId: payload.customerId || null
            }
        };
    }

    private static buildVariantText(payload: any): KnowledgeTextResult {
        const title = payload.title || "Variant";
        let text = `Shopify variant data\n`;
        text += `Product ID: ${payload.productExternalId || ""}\n`;
        text += `Variant title: ${payload.title || ""}\n`;
        text += `SKU: ${payload.sku || ""}\n`;
        text += `Price: ${payload.price || 0}\n`;
        text += `Inventory quantity: ${payload.inventoryQuantity || 0}\n`;

        return {
            title,
            text,
            productAvailability: payload.inventoryQuantity > 0,
            customerId: null,
            sourceType: "variant",
            language: "en",
            metadata: {
                productAvailability: payload.inventoryQuantity > 0
            }
        };
    }
}
