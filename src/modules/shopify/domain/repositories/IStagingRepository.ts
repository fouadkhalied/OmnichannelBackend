import { ShopifyEntityType } from "../valueObjects/ShopifyEntityType";
import { SyncCursor } from "../types/SyncCursor";

export type EmbedStatus = "pending" | "processing" | "completed" | "failed" | "skip";
export type EnrichStatus = "pending" | "processing" | "completed" | "failed" | "skip";

export interface StagingUpsertInput {
    tenantId: string;
    entityType: ShopifyEntityType;
    externalId: string;
    parentExternalId: string | null;
    payload: unknown;
    payloadHash: string;
    deleted: boolean;
    shopifyUpdatedAt: Date | null;
    embedStatus: "pending" | "skip";
    enrichStatus: "pending" | "skip";
}

export interface StagingRecord {
    id: string;
    tenantId: string;
    entityType: ShopifyEntityType;
    externalId: string;
    parentExternalId: string | null;
    payload: unknown;
    payloadHash: string;
    deleted: boolean;
    shopifyUpdatedAt: Date | null;
    embedStatus: EmbedStatus;
    enrichStatus: EnrichStatus;
    knowledgeDocumentId: string | null;
    imageSignature: string | null;
    embedError: string | null;
    enrichError: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IStagingRepository {
    upsert(input: StagingUpsertInput): Promise<StagingRecord>;
    findByExternalId(
        tenantId: string,
        entityType: ShopifyEntityType,
        externalId: string
    ): Promise<StagingRecord | null>;
    findAllActiveExternalIds(
        tenantId: string,
        entityType: ShopifyEntityType
    ): Promise<string[]>;
    markDeleted(
        tenantId: string,
        entityType: ShopifyEntityType,
        externalId: string
    ): Promise<void>;
    claimNextPendingEmbedding(batchSize: number): Promise<StagingRecord[]>;
    markEmbedProcessing(ids: string[]): Promise<void>;
    markEmbedCompleted(id: string, knowledgeDocumentId: string): Promise<void>;
    markEmbedFailed(id: string, error: string): Promise<void>;
    claimNextPendingEnrichment(batchSize: number): Promise<StagingRecord[]>;
    markEnrichProcessing(ids: string[]): Promise<void>;
    markEnrichCompleted(id: string, imageSignature: string): Promise<void>;
    markEnrichFailed(id: string, error: string): Promise<void>;
    saveCursor(tenantId: string, jobId: string, cursor: SyncCursor): Promise<void>;
    getCursor(tenantId: string, jobId: string): Promise<SyncCursor | null>;
    countPendingByTenant(tenantId: string): Promise<{ embedPending: number, enrichPending: number }>;
}
