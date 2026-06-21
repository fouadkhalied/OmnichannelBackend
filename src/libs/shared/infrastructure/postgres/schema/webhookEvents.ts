import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";

export const webhookEvents = pgTable("webhook_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // pending | processed | failed
    error: text("error"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_webhooks_store").on(t.storeId),
    topicIdx: index("idx_webhooks_topic").on(t.topic),
    extIdx: index("idx_webhooks_external").on(t.externalId),
}));

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
