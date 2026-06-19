import { createApp } from "../src/libs/shared/presentation/http/app";
import { connectPostgres, requireDb } from "../src/libs/shared/infrastructure/postgres/PgClient";
import { UnitOfWorkFactory } from "../src/libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { logger } from "../src/libs/common/logger";
import { connectMongo } from "@shared/infrastructure/mongo/MongoClient";
import { env } from "../src/config/env";

// Infrastructure
import { PgSyncJobRepository } from "../src/modules/shopify/infrastructure/postgres/repositories/PgSyncJobRepository";
import { PgStagingRepository } from "../src/modules/shopify/infrastructure/postgres/repositories/PgStagingRepository";

import { MongoKnowledgeRepository } from "../src/modules/ai/infrastructure/mongo/MongoKnowledgeRepository";
import { OpenAIEmbeddingRepository } from "../src/modules/ai/infrastructure/openai/OpenAIEmbeddingRepository";

// Domain services
import { ChangeDetectionService } from "../src/modules/shopify/domain/services/ChangeDetectionService";

// Use cases
import { RunSyncJobUseCase } from "../src/modules/shopify/application/useCases/sync/RunSyncJobUseCase";
import { MarkStaleEntitiesUseCase } from "../src/modules/shopify/application/useCases/sync/MarkStaleEntitiesUseCase";
import { GenerateEmbeddingUseCase } from "../src/modules/shopify/application/useCases/embedding/GenerateEmbeddingUseCase";
import { EnrichProductImagesUseCase } from "../src/modules/shopify/application/useCases/embedding/EnrichProductImagesUseCase";

// Workers
import { SyncWorker } from "../src/modules/shopify/application/workers/SyncWorker";
import { createEmbeddingWorker } from "../src/modules/shopify/application/workers/EmbeddingWorker";
import { createEnrichmentWorker } from "../src/modules/shopify/application/workers/EnrichmentWorker";

import type { TenantContext } from "@shared/domain/valueObjects/TenantContext";
import { ShopifyGraphQLClient } from "src/modules/shopify/infrastructure/shopify/graphql/ShopifyGraphQLClient";
import { PgConnectorRepository } from "../src/libs/shared/infrastructure/postgres/repositories/PgConnectorRepository";

const PORT = env.PORT;

async function bootstrap() {
    try {
        // Connect to MongoDB
        //await connectMongo();

        // Connect to Postgres
        await connectPostgres();
        const db = requireDb();
        const uowFactory = new UnitOfWorkFactory(db);

        // ── Shared infrastructure ──────────────────────────
        const stagingRepository = new PgStagingRepository();
        const syncJobRepository = new PgSyncJobRepository();
        const connectorRepository = new PgConnectorRepository();
        const shopifyClient = new ShopifyGraphQLClient();
        const knowledgeRepository = new MongoKnowledgeRepository();
        const embeddingRepository = new OpenAIEmbeddingRepository();
        const changeDetectionService = new ChangeDetectionService();

        // ── SyncWorker ─────────────────────────────────────
        const markStaleEntities = new MarkStaleEntitiesUseCase(
            stagingRepository,
        );

        const runSyncJob = new RunSyncJobUseCase(
            shopifyClient,
            stagingRepository,
            connectorRepository,
            syncJobRepository,
            changeDetectionService,
            markStaleEntities,
        );

        const syncWorker = new SyncWorker(syncJobRepository, runSyncJob);

        // ── EmbeddingWorker ────────────────────────────────
        const embeddingWorker = createEmbeddingWorker(
            stagingRepository,
            (context: TenantContext) => new GenerateEmbeddingUseCase(
                context,
                stagingRepository,
                knowledgeRepository,
                embeddingRepository,
            ),
        );

        // ── EnrichmentWorker ───────────────────────────────
        const enrichmentWorker = createEnrichmentWorker(
            stagingRepository,
            (context: TenantContext) => new EnrichProductImagesUseCase(
                context,
                stagingRepository,
                knowledgeRepository,
                embeddingRepository,
            ),
        );

        // ── Start workers ──────────────────────────────────
        await syncWorker.start();
        embeddingWorker.start();
        enrichmentWorker.start();

        // ── Start HTTP server ──────────────────────────────
        const server = createApp(uowFactory);
        server.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`, {
                port: PORT,
                url: `http://localhost:${PORT}`,
            });
        });

        // ── Graceful shutdown ──────────────────────────────
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received, shutting down`);
            await syncWorker.stop();
            embeddingWorker.stop();
            enrichmentWorker.stop();
            process.exit(0);
        };
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

    } catch (error: any) {
        logger.error("Failed to start server", { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection", { reason: String(reason) });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
    process.exit(1);
});

bootstrap();
