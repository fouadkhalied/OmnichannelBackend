export class ShopifyTopicMapper {
    /**
     * Maps a Shopify webhook topic (e.g., 'products/update') to an internal event type (e.g., 'shopify.products.update').
     * @param topic The Shopify topic from the webhook header
     * @returns The internalized event type string
     */
    public static toEventType(topic: string): string {
        if (!topic) {
            return "shopify.unknown";
        }

        // Shopify topics are typically in the format of 'group/action' (e.g., 'products/update')
        // We map them to 'shopify.group.action'
        return `shopify.${topic.replace(/\//g, ".")}`;
    }
}
