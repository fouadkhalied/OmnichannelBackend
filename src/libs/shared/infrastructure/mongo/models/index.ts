import mongoose, { Schema, model } from "mongoose";
const { models } = mongoose;
import {
    aiModeEnum,
    aiStatusEnum,
    broadcastStatusEnum,
    messageDirectionEnum,
    platformEnum,
} from "@shared/schema";

const baseOptions = {
    versionKey: false as const,
};

const organizationSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "organizations" },
);

const storeSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        platform: { type: String, default: "shopify" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "stores" },
);

const appUserWorkspaceSchema = new Schema(
    {
        organizationId: { type: String, required: true },
        storeId: { type: String, required: true },
        role: { type: String, default: "admin" },
    },
    { _id: false },
);

const appUserSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: false, index: true },
        email: { type: String, required: false, index: true },
        passwordHash: { type: String, required: false, select: false },
        displayName: { type: String, required: false },
        isActivated: { type: Boolean, default: false, index: true },
        activationRequestedAt: { type: Date, default: Date.now },
        activatedAt: { type: Date, default: null },
        role: { type: String, default: "member" },
        workspaces: { type: [appUserWorkspaceSchema], default: [] },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "app_users" },
);

const customerSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        phone: { type: String, default: null },
        email: { type: String, default: null },
        platform: { type: String, enum: platformEnum, required: true },
        aiStatus: { type: String, enum: aiStatusEnum, default: "active" },
        notes: { type: String, default: null },
        lastActive: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "customers" },
);
customerSchema.index(
    { organizationId: 1, storeId: 1, phone: 1 },
    {
        unique: true,
        partialFilterExpression: { phone: { $type: "string" } },
    },
);

const customerCommentSchema = new Schema(
    {
        id: { type: Number, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        content: { type: String, required: true },
        createdBy: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "customer_comments" },
);

const conversationSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        platform: { type: String, enum: platformEnum, required: true },
        aiMode: { type: String, enum: aiModeEnum, default: "auto", index: true },
        escalationState: {
            type: String,
            enum: ["none", "open", "assigned", "resolved"],
            default: "none",
            index: true,
        },
        assigneeId: { type: String, default: null, index: true },
        unreadCount: { type: Number, default: 0 },
        lastMessagePreview: { type: String, default: null },
        journeyContext: { type: Schema.Types.Mixed, default: null },
        qualification: { type: Schema.Types.Mixed, default: null },
        channelSwitch: { type: Schema.Types.Mixed, default: null },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "conversations" },
);
conversationSchema.index({ organizationId: 1, storeId: 1, customerId: 1, updatedAt: -1 });

const messageSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        conversationId: { type: String, required: true, index: true },
        direction: { type: String, enum: messageDirectionEnum, required: true },
        content: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "messages" },
);
messageSchema.index({ organizationId: 1, conversationId: 1, createdAt: 1 });

const broadcastSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        message: { type: String, required: true },
        platforms: { type: [String], default: [] },
        status: { type: String, enum: broadcastStatusEnum, default: "draft" },
        sentCount: { type: Number, default: 0 },
        deliveredCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        scheduledAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "broadcasts" },
);

const settingsSchema = new Schema(
    {
        id: { type: Number, required: true, unique: true },
        userId: { type: String, required: true, unique: true },
        organizationId: { type: String, default: null, index: true },
        storeId: { type: String, default: null, index: true },
        aiApiKey: { type: String, default: null },
        openAiApiKey: { type: String, default: null },
        geminiApiKey: { type: String, default: null },
        deepseekApiKey: { type: String, default: null },
        autoResponseEnabled: { type: Boolean, default: true },
        bufferSeconds: { type: Number, default: 20 },
        businessHoursMessage: { type: String, default: null },
        productCategoryIntents: { type: [Schema.Types.Mixed], default: null },
        whatsappConfig: { type: Schema.Types.Mixed, default: null },
        playbookText: { type: String, default: "" },
        playbookFileName: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "settings" },
);

const counterSchema = new Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: Number, required: true, default: 0 },
    },
    { ...baseOptions, collection: "counters" },
);

const connectorSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        provider: {
            type: String,
            enum: ["shopify", "meta", "whatsapp"],
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["connected", "disconnected", "error"],
            default: "disconnected",
        },
        lastSyncAt: { type: Date, default: null },
        lastError: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "connectors" },
);
connectorSchema.index({ organizationId: 1, storeId: 1, provider: 1 }, { unique: true });

const connectorCredentialSchema = new Schema(
    {
        connectorId: { type: String, required: true, unique: true, index: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        provider: {
            type: String,
            enum: ["shopify", "meta", "whatsapp"],
            required: true,
            index: true,
        },
        shopDomain: { type: String, default: null, index: true },
        encryptedCredentials: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "connector_credentials" },
);
connectorCredentialSchema.index({ organizationId: 1, storeId: 1, provider: 1 }, { unique: true });
connectorCredentialSchema.index({ provider: 1, shopDomain: 1, updatedAt: -1 });

const orderSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        externalOrderId: { type: String, required: true },
        source: { type: String, default: "shopify" },
        payload: { type: Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "orders" },
);
orderSchema.index({ organizationId: 1, storeId: 1, externalOrderId: 1 }, { unique: true });

const orderNotificationSchema = new Schema(
    {
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        externalOrderId: { type: String, required: true, index: true },
        type: { type: String, enum: ["confirmation", "cancellation"], required: true, index: true },
        status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
        attempts: { type: Number, default: 0 },
        lastError: { type: String, default: null },
        renderedMessage: { type: String, default: null },
        sentAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "order_notifications" },
);
orderNotificationSchema.index(
    { organizationId: 1, storeId: 1, externalOrderId: 1, type: 1 },
    { unique: true },
);

const shopifyEntitySchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        entityType: {
            type: String,
            enum: ["product", "variant", "inventory", "customer", "order"],
            required: true,
            index: true,
        },
        externalId: { type: String, required: true, index: true },
        parentExternalId: { type: String, default: null, index: true },
        payload: { type: Schema.Types.Mixed, default: null },
        deleted: { type: Boolean, default: false, index: true },
        sourceUpdatedAt: { type: Date, default: null },
        knowledgeDocumentId: { type: String, default: null, index: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "shopify_entities" },
);
shopifyEntitySchema.index(
    { organizationId: 1, storeId: 1, entityType: 1, externalId: 1 },
    { unique: true },
);
shopifyEntitySchema.index({ organizationId: 1, storeId: 1, entityType: 1, updatedAt: -1 });

const syncJobSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        provider: { type: String, enum: ["shopify"], required: true, index: true },
        type: { type: String, enum: ["full_backfill", "reconciliation"], required: true, index: true },
        status: {
            type: String,
            enum: ["pending", "running", "retry_scheduled", "completed", "failed"],
            default: "pending",
            index: true,
        },
        progress: { type: Schema.Types.Mixed, default: null },
        cursor: { type: Schema.Types.Mixed, default: null },
        triggeredBy: { type: String, default: "system" },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        nextRunAt: { type: Date, default: Date.now, index: true },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        error: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "sync_jobs" },
);
syncJobSchema.index({ provider: 1, status: 1, nextRunAt: 1 });
syncJobSchema.index({ organizationId: 1, storeId: 1, createdAt: -1 });

const productImageEnrichmentJobSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        provider: { type: String, enum: ["shopify"], default: "shopify", index: true },
        productExternalId: { type: String, required: true, index: true },
        knowledgeDocumentId: { type: String, required: true, index: true },
        imageSignature: { type: String, required: true, index: true },
        imageUrls: { type: [String], default: [] },
        status: {
            type: String,
            enum: ["pending", "running", "retry_scheduled", "completed", "dead_letter"],
            default: "pending",
            index: true,
        },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        nextRunAt: { type: Date, default: Date.now, index: true },
        lastError: { type: String, default: null },
        summarizerProvider: { type: String, default: null },
        summarizerModel: { type: String, default: null },
        visualDescriptors: { type: [String], default: [] },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "product_image_enrichment_jobs" },
);
productImageEnrichmentJobSchema.index({ status: 1, nextRunAt: 1 });
productImageEnrichmentJobSchema.index({
    organizationId: 1,
    storeId: 1,
    productExternalId: 1,
    createdAt: -1,
});
productImageEnrichmentJobSchema.index({
    organizationId: 1,
    storeId: 1,
    productExternalId: 1,
    imageSignature: 1,
    status: 1,
});

const eventInboxSchema = new Schema(
    {
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        source: { type: String, required: true },
        eventType: { type: String, required: true },
        externalEventId: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: null },
        status: { type: String, enum: ["received", "processed", "failed"], default: "received" },
        processedAt: { type: Date, default: null },
        error: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "events_inbox" },
);
eventInboxSchema.index({ source: 1, externalEventId: 1 }, { unique: true });

const eventOutboxSchema = new Schema(
    {
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        source: { type: String, required: true },
        eventType: { type: String, required: true },
        externalEventId: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: null },
        status: { type: String, default: "pending" },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        nextRetryAt: { type: Date, default: Date.now },
        lastError: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "events_outbox" },
);
eventOutboxSchema.index({ source: 1, eventType: 1, createdAt: -1 });
eventOutboxSchema.index({ status: 1, nextRetryAt: 1 });

const analyticsEventSchema = new Schema(
    {
        organizationId: { type: String, required: true },
        eventType: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "analytics_events" },
);
analyticsEventSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 });

const aiKnowledgeDocumentSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        title: { type: String, required: true },
        sourceType: { type: String, default: "faq", index: true },
        language: { type: String, default: "en", index: true },
        text: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed, default: null },
        status: { type: String, enum: ["active", "archived"], default: "active" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "ai_knowledge_documents" },
);
aiKnowledgeDocumentSchema.index({ organizationId: 1, storeId: 1, updatedAt: -1 });

const aiChunkSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        documentId: { type: String, required: true, index: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        language: { type: String, default: "en", index: true },
        text: { type: String, required: true },
        startChar: { type: Number, required: true },
        endChar: { type: Number, required: true },
        tokenCount: { type: Number, default: 0 },
        productAvailability: { type: Boolean, default: true, index: true },
        sourceType: { type: String, default: "faq", index: true },
        externalId: { type: String, default: null, index: true },
        customerId: { type: String, default: null, index: true },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "ai_chunks" },
);
aiChunkSchema.index({ organizationId: 1, storeId: 1, language: 1, createdAt: -1 });
aiChunkSchema.index({ organizationId: 1, storeId: 1, sourceType: 1, customerId: 1, createdAt: -1 });

const aiEmbeddingSchema = new Schema(
    {
        chunkId: { type: String, required: true, unique: true, index: true },
        documentId: { type: String, required: true, index: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        model: { type: String, default: "deterministic-hash-v1" },
        dimension: { type: Number, required: true },
        vector: { type: [Number], required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "ai_embeddings" },
);
aiEmbeddingSchema.index({ organizationId: 1, storeId: 1, documentId: 1 });

const businessRuleSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        maxDiscountPercent: { type: Number, default: 20 },
        forbiddenClaims: { type: [String], default: [] },
        preferredUpsell: { type: [String], default: [] },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "business_rules" },
);
businessRuleSchema.index({ organizationId: 1, storeId: 1 }, { unique: true });

const cartSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        status: { type: String, enum: ["active", "abandoned", "converted"], default: "active" },
        items: { type: [Schema.Types.Mixed], default: [] },
        total: { type: Number, default: 0 },
        currency: { type: String, default: "USD" },
        checkoutUrl: { type: String, default: null },
        recoveredAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "carts" },
);
cartSchema.index({ organizationId: 1, storeId: 1, customerId: 1, updatedAt: -1 });

const campaignSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        type: { type: String, default: "recovery" },
        status: { type: String, enum: ["scheduled", "sent", "failed"], default: "scheduled" },
        audience: { type: Schema.Types.Mixed, default: null },
        template: { type: Schema.Types.Mixed, default: null },
        scheduleAt: { type: Date, default: Date.now },
        sentAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "campaigns" },
);
campaignSchema.index({ organizationId: 1, storeId: 1, type: 1, createdAt: -1 });

const supportTicketSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        conversationId: { type: String, default: null, index: true },
        customerId: { type: String, default: null, index: true },
        channel: { type: String, enum: ["email", "whatsapp", "website"], default: "website" },
        intent: { type: String, default: "unknown" },
        sentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "neutral" },
        status: { type: String, enum: ["open", "assigned", "resolved", "closed"], default: "open" },
        priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
        assigneeId: { type: String, default: null },
        notes: { type: [String], default: [] },
        transcript: { type: [Schema.Types.Mixed], default: [] },
        source: { type: Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "support_tickets" },
);
supportTicketSchema.index({ organizationId: 1, storeId: 1, status: 1, updatedAt: -1 });

const auditLogSchema = new Schema(
    {
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        actorId: { type: String, default: null },
        role: { type: String, default: null },
        action: { type: String, required: true, index: true },
        targetType: { type: String, default: null },
        targetId: { type: String, default: null },
        payload: { type: Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "audit_logs" },
);
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });

const identityLinkSchema = new Schema(
    {
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        anonymousId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        firstSeenAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "identity_links" },
);
identityLinkSchema.index({ organizationId: 1, storeId: 1, anonymousId: 1 }, { unique: true });

const complianceActionSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        actionType: { type: String, enum: ["consent", "data_export", "data_delete"], required: true },
        subjectType: { type: String, default: "customer" },
        subjectId: { type: String, required: true },
        status: { type: String, enum: ["requested", "completed", "failed"], default: "requested" },
        result: { type: Schema.Types.Mixed, default: null },
        requestedBy: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "compliance_actions" },
);
complianceActionSchema.index({ organizationId: 1, storeId: 1, actionType: 1, createdAt: -1 });

const conversationBufferSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        conversationId: { type: String, required: true, index: true },
        channel: { type: String, enum: platformEnum, required: true, index: true },
        status: { type: String, enum: ["collecting", "ready", "processing"], default: "collecting", index: true },
        parts: { type: [Schema.Types.Mixed], default: [] },
        lastMessageAt: { type: Date, default: Date.now, index: true },
        expiresAt: { type: Date, required: true, index: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "conversation_buffers" },
);
conversationBufferSchema.index(
    { organizationId: 1, storeId: 1, conversationId: 1, channel: 1 },
    { unique: true },
);
conversationBufferSchema.index({ status: 1, expiresAt: 1 });

const messageAttachmentSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        messageId: { type: String, required: true, index: true },
        conversationId: { type: String, required: true, index: true },
        provider: { type: String, default: "unknown", index: true },
        mediaType: { type: String, enum: ["image", "audio", "video", "file"], required: true, index: true },
        mimeType: { type: String, default: null },
        sizeBytes: { type: Number, default: null },
        sha256: { type: String, default: null, index: true },
        storageKey: { type: String, default: null },
        transcript: { type: String, default: null },
        tags: { type: [String], default: [] },
        caption: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "message_attachments" },
);
messageAttachmentSchema.index({ organizationId: 1, storeId: 1, conversationId: 1, createdAt: -1 });

const customerMemoryProfileSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        preferredColors: { type: [String], default: [] },
        preferredStyles: { type: [String], default: [] },
        budgetMin: { type: Number, default: null },
        budgetMax: { type: Number, default: null },
        lastProducts: { type: [Schema.Types.Mixed], default: [] },
        summary: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "customer_memory_profiles" },
);
customerMemoryProfileSchema.index(
    { organizationId: 1, storeId: 1, customerId: 1 },
    { unique: true },
);

const escalationPolicySchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        queue: { type: String, enum: ["sales", "support", "technical"], required: true, index: true },
        assigneeIds: { type: [String], default: [] },
        moderatorPhones: { type: [String], default: [] },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "escalation_policies" },
);
escalationPolicySchema.index(
    { organizationId: 1, storeId: 1, queue: 1 },
    { unique: true },
);

const escalationTicketSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        organizationId: { type: String, required: true, index: true },
        storeId: { type: String, required: true, index: true },
        conversationId: { type: String, required: true, index: true },
        customerId: { type: String, required: true, index: true },
        queue: { type: String, enum: ["sales", "support", "technical"], required: true, index: true },
        priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
        status: { type: String, enum: ["open", "assigned", "resolved"], default: "open", index: true },
        reason: { type: String, default: "manual_request" },
        summary: { type: String, default: "" },
        assigneeId: { type: String, default: null, index: true },
        createdBy: { type: String, default: "system" },
        resolvedBy: { type: String, default: null },
        resolvedAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { ...baseOptions, collection: "escalation_tickets" },
);
escalationTicketSchema.index({ organizationId: 1, storeId: 1, status: 1, priority: 1, createdAt: -1 });

export const OrganizationModel =
    models.Organization || model("Organization", organizationSchema);
export const StoreModel = models.Store || model("Store", storeSchema);
export const AppUserModel = models.AppUser || model("AppUser", appUserSchema);
export const CustomerModel = models.Customer || model("Customer", customerSchema);
export const CustomerCommentModel =
    models.CustomerComment || model("CustomerComment", customerCommentSchema);
export const ConversationModel =
    models.Conversation || model("Conversation", conversationSchema);
export const MessageModel = models.Message || model("Message", messageSchema);
export const BroadcastModel = models.Broadcast || model("Broadcast", broadcastSchema);
export const SettingsModel = models.Settings || model("Settings", settingsSchema);
export const CounterModel = models.Counter || model("Counter", counterSchema);
export const ConnectorModel = models.Connector || model("Connector", connectorSchema);
export const ConnectorCredentialModel =
    models.ConnectorCredential || model("ConnectorCredential", connectorCredentialSchema);
export const OrderModel = models.Order || model("Order", orderSchema);
export const OrderNotificationModel =
    models.OrderNotification || model("OrderNotification", orderNotificationSchema);
export const ShopifyEntityModel = models.ShopifyEntity || model("ShopifyEntity", shopifyEntitySchema);
export const SyncJobModel = models.SyncJob || model("SyncJob", syncJobSchema);
export const ProductImageEnrichmentJobModel =
    models.ProductImageEnrichmentJob ||
    model("ProductImageEnrichmentJob", productImageEnrichmentJobSchema);
export const EventInboxModel = models.EventInbox || model("EventInbox", eventInboxSchema);
export const EventOutboxModel = models.EventOutbox || model("EventOutbox", eventOutboxSchema);
export const AnalyticsEventModel =
    models.AnalyticsEvent || model("AnalyticsEvent", analyticsEventSchema);
export const AiKnowledgeDocumentModel =
    models.AiKnowledgeDocument || model("AiKnowledgeDocument", aiKnowledgeDocumentSchema);
export const AiChunkModel = models.AiChunk || model("AiChunk", aiChunkSchema);
export const AiKnowledgeDocumentImageProfileModel = models.AiKnowledgeDocumentImageProfile || model("AiKnowledgeDocumentImageProfile", productImageEnrichmentJobSchema); // Aliased for compatibility
export const AiEmbeddingModel = models.AiEmbedding || model("AiEmbedding", aiEmbeddingSchema);
export const BusinessRuleModel =
    models.BusinessRule || model("BusinessRule", businessRuleSchema);
export const CartModel = models.Cart || model("Cart", cartSchema);
export const CampaignModel = models.Campaign || model("Campaign", campaignSchema);
export const SupportTicketModel =
    models.SupportTicket || model("SupportTicket", supportTicketSchema);
export const AuditLogModel = models.AuditLog || model("AuditLog", auditLogSchema);
export const IdentityLinkModel = models.IdentityLink || model("IdentityLink", identityLinkSchema);
export const ComplianceActionModel =
    models.ComplianceAction || model("ComplianceAction", complianceActionSchema);
export const ConversationBufferModel =
    models.ConversationBuffer || model("ConversationBuffer", conversationBufferSchema);
export const MessageAttachmentModel =
    models.MessageAttachment || model("MessageAttachment", messageAttachmentSchema);
export const CustomerMemoryProfileModel =
    models.CustomerMemoryProfile || model("CustomerMemoryProfile", customerMemoryProfileSchema);
export const EscalationPolicyModel =
    models.EscalationPolicy || model("EscalationPolicy", escalationPolicySchema);
export const EscalationTicketModel =
    models.EscalationTicket || model("EscalationTicket", escalationTicketSchema);

export async function nextSequence(key: string): Promise<number> {
    const counter = await CounterModel.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return counter?.value ?? 1;
}

export async function ensureMongoIndexes() {
    await Promise.all([
        OrganizationModel.createIndexes(),
        StoreModel.createIndexes(),
        AppUserModel.createIndexes(),
        CustomerModel.createIndexes(),
        CustomerCommentModel.createIndexes(),
        ConversationModel.createIndexes(),
        MessageModel.createIndexes(),
        BroadcastModel.createIndexes(),
        SettingsModel.createIndexes(),
        ConnectorModel.createIndexes(),
        ConnectorCredentialModel.createIndexes(),
        OrderModel.createIndexes(),
        OrderNotificationModel.createIndexes(),
        ShopifyEntityModel.createIndexes(),
        SyncJobModel.createIndexes(),
        ProductImageEnrichmentJobModel.createIndexes(),
        EventInboxModel.createIndexes(),
        EventOutboxModel.createIndexes(),
        AnalyticsEventModel.createIndexes(),
        AiKnowledgeDocumentModel.createIndexes(),
        AiChunkModel.createIndexes(),
        AiEmbeddingModel.createIndexes(),
        BusinessRuleModel.createIndexes(),
        CartModel.createIndexes(),
        CampaignModel.createIndexes(),
        SupportTicketModel.createIndexes(),
        AuditLogModel.createIndexes(),
        IdentityLinkModel.createIndexes(),
        ComplianceActionModel.createIndexes(),
        ConversationBufferModel.createIndexes(),
        MessageAttachmentModel.createIndexes(),
        CustomerMemoryProfileModel.createIndexes(),
        EscalationPolicyModel.createIndexes(),
        EscalationTicketModel.createIndexes(),
    ]);
}
