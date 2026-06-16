import { ShopifyCustomer } from "../../../../domain/entities/ShopifyCustomer";

export class CustomerMapper {
    static toDomain(node: any, tenantId: string): ShopifyCustomer {
        const externalId = this.extractId(node.id);

        return new ShopifyCustomer(
            `c_${externalId}`,
            externalId,
            tenantId,
            node.firstName,
            node.lastName,
            node.email,
            node.phone,
            node.numberOfOrders || 0,
            node.amountSpent?.amount || "0.00",
            node.tags || [],
            node.updatedAt ? new Date(node.updatedAt) : new Date()
        );
    }

    private static extractId(gid: string): string {
        if (!gid) return "";
        const parts = gid.split("/");
        return parts[parts.length - 1];
    }
}
