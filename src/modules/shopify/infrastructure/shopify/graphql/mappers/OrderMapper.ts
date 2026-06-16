import { ShopifyOrder, ShopifyLineItem } from "../../../../domain/entities/ShopifyOrder";

export class OrderMapper {
    static toDomain(node: any, tenantId: string): ShopifyOrder {
        const externalId = this.extractId(node.id);

        const lineItems: ShopifyLineItem[] = (node.lineItems?.edges || []).map((edge: any) => ({
            title: edge.node.title,
            quantity: edge.node.quantity,
            price: edge.node.originalUnitPriceSet?.shopMoney?.amount || "0.00"
        }));

        return new ShopifyOrder(
            `o_${externalId}`,
            externalId,
            tenantId,
            node.name,
            node.displayFinancialStatus,
            node.displayFulfillmentStatus,
            node.currencyCode || "USD",
            node.totalPriceSet?.shopMoney?.amount || "0.00",
            node.customer ? this.extractId(node.customer.id) : null,
            lineItems,
            node.updatedAt ? new Date(node.updatedAt) : new Date()
        );
    }

    private static extractId(gid: string): string {
        if (!gid) return "";
        const parts = gid.split("/");
        return parts[parts.length - 1];
    }
}
