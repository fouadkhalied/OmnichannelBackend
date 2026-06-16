import { EventEmitter } from "events";

export interface IEventPublisher {
    publish(event: unknown): Promise<void>;
}

export const shopifyEvents = new EventEmitter();

export class InMemoryEventPublisher implements IEventPublisher {
    async publish(event: unknown): Promise<void> {
        shopifyEvents.emit("shopify_event", event);
        console.log(`[EventPublisher] Publishing event:`, JSON.stringify(event));
    }
}
