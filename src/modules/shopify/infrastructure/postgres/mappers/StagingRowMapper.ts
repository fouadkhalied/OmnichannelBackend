import { StagingRecord, EmbedStatus, EnrichStatus } from "../../../domain/repositories/IStagingRepository";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { StagingRow } from "../schema/stadging.schema";

export class StagingRowMapper {
    static toDomain(row: StagingRow): StagingRecord {
        try {
            return {
                id: row.id,
                tenantId: row.tenantId,
                entityType: ShopifyEntityType.fromString(row.entityType),
                externalId: row.externalId,
                parentExternalId: row.parentExternalId,
                payload: row.payload,
                payloadHash: row.payloadHash,
                deleted: row.deleted,
                shopifyUpdatedAt: row.shopifyUpdatedAt,
                embedStatus: row.embedStatus as EmbedStatus,
                enrichStatus: row.enrichStatus as EnrichStatus,
                knowledgeDocumentId: row.knowledgeDocumentId,
                imageSignature: row.imageSignature,
                embedError: row.embedError,
                enrichError: row.enrichError,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        } catch (error) {
            // Defensive parsing for JSONB is handled at Drizzle level, 
            // but we wrap here as requested
            throw new Error(`Failed to map staging row ${row.id}: ${error}`);
        }
    }

    static toPersistence(entity: Partial<StagingRecord>): any {
        const row: any = {};
        if (entity.id) row.id = entity.id;
        if (entity.tenantId) row.tenant_id = entity.tenantId;
        if (entity.entityType) row.entity_type = entity.entityType.getValue();
        if (entity.externalId) row.external_id = entity.externalId;
        if (entity.parentExternalId !== undefined) row.parent_external_id = entity.parentExternalId;
        if (entity.payload) row.payload = entity.payload;
        if (entity.payloadHash) row.payload_hash = entity.payloadHash;
        if (entity.deleted !== undefined) row.deleted = entity.deleted;
        if (entity.shopifyUpdatedAt !== undefined) row.shopify_updated_at = entity.shopifyUpdatedAt;
        if (entity.embedStatus) row.embed_status = entity.embedStatus;
        if (entity.enrichStatus) row.enrich_status = entity.enrichStatus;
        if (entity.knowledgeDocumentId !== undefined) row.knowledge_document_id = entity.knowledgeDocumentId;
        if (entity.imageSignature !== undefined) row.image_signature = entity.imageSignature;
        if (entity.embedError !== undefined) row.embed_error = entity.embedError;
        if (entity.enrichError !== undefined) row.enrich_error = entity.enrichError;

        return row;
    }
}
