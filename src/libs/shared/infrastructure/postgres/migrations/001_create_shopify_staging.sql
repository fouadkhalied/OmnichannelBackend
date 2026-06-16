-- 001_shopify_staging_partitioning.sql

-- Create the master table with partitioning
CREATE TABLE IF NOT EXISTS shopify_staging (
    id                    TEXT DEFAULT gen_random_uuid(),
    tenant_id             TEXT NOT NULL,
    entity_type           TEXT NOT NULL,
    external_id           TEXT NOT NULL,
    parent_external_id    TEXT,
    payload               JSONB NOT NULL,
    payload_hash          TEXT NOT NULL,
    deleted               BOOLEAN NOT NULL DEFAULT false,
    shopify_updated_at    TIMESTAMPTZ,

    embed_status          TEXT NOT NULL DEFAULT 'pending',
    enrich_status         TEXT NOT NULL DEFAULT 'skip',
    knowledge_document_id TEXT,
    image_signature       TEXT,
    embed_error           TEXT,
    enrich_error          TEXT,

    last_embedded_at      TIMESTAMPTZ,
    last_enriched_at      TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, entity_type, external_id)
) PARTITION BY LIST (tenant_id);

-- Create the default partition to catch any tenants without explicit partitions
CREATE TABLE IF NOT EXISTS shopify_staging_default 
    PARTITION OF shopify_staging DEFAULT;

-- Partition-aware indexes
CREATE INDEX IF NOT EXISTS idx_staging_tenant_type
    ON shopify_staging (tenant_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_staging_embed_pending
    ON shopify_staging (tenant_id, embed_status, updated_at)
    WHERE embed_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_staging_enrich_pending
    ON shopify_staging (tenant_id, enrich_status, updated_at)
    WHERE enrich_status IN ('pending', 'processing')
    AND entity_type = 'product';
