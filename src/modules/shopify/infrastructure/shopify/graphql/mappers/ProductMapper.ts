import { ShopifyProduct, ShopifyImage } from "../../../../domain/entities/ShopifyProduct";
import { ShopifyVariant } from "../../../../domain/entities/ShopifyVariant";

export class ProductMapper {
    static toDomain(node: any, tenantId: string): ShopifyProduct {
        const externalId = this.extractId(node.id);

        // Map images
        const images: ShopifyImage[] = (node.images?.edges || []).map((edge: any) => ({
            id: this.extractId(edge.node.id),
            url: edge.node.url,
            altText: edge.node.altText,
            width: edge.node.width,
            height: edge.node.height,
            variantIds: [], // To be populated if needed, but usually products have images
        }));

        // Map variants
        const variants: ShopifyVariant[] = (node.variants?.edges || []).map((edge: any) => {
            const vNode = edge.node;
            const vExternalId = this.extractId(vNode.id);

            // Map inventory levels from inventoryItem
            const inventoryLevels = vNode.inventoryItem?.inventoryLevels?.edges || [];
            const totalQuantity = vNode.inventoryQuantity ?? 0;

            return new ShopifyVariant(
                `v_${vExternalId}`,
                vExternalId,
                externalId, // productExternalId
                tenantId,
                vNode.title,
                vNode.sku,
                vNode.price,
                vNode.compareAtPrice,
                totalQuantity,
                this.extractId(vNode.inventoryItem?.id || ""), // inventoryItemId
                vNode.updatedAt ? new Date(vNode.updatedAt) : new Date()
            );
        });

        return new ShopifyProduct(
            `p_${externalId}`, // Local ID
            externalId,
            tenantId,
            node.title,
            node.handle,
            node.vendor,
            node.productType,
            node.status,
            node.descriptionHtml,
            node.tags || [],
            images,
            variants,
            node.updatedAt ? new Date(node.updatedAt) : new Date(),
            node.createdAt ? new Date(node.createdAt) : new Date()
        );
    }

    static extractId(gid: string): string {
        if (!gid) return "";
        const parts = gid.split("/");
        return parts[parts.length - 1];
    }
}
