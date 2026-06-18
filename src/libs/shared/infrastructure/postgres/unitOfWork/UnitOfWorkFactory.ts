import { PgProductRepository } from "../repositories/PgProductRepository";
import { PgEmbeddingRepository } from "../repositories/PgEmbeddingRepository";
import { PgCredentialRepository } from "../repositories/PgCredentialRepository";
import { PgCustomerRepository } from "../repositories/PgCustomerRepository";
import { PgOrderRepository } from "../repositories/PgOrderRepository";
import { PgOrderLineItemRepository } from "../repositories/PgOrderLineItemRepository";
import { PgUserRepository } from "../repositories/PgUserRepository";
import { PgOrganizationRepository } from "../repositories/PgOrganizationRepository";
import { PgStoreRepository } from "../repositories/PgStoreRepository";
import { PgSyncJobRepository } from "../../../../../modules/shopify/infrastructure/postgres/repositories/PgSyncJobRepository";
import { PgStagingRepository } from "../../../../../modules/shopify/infrastructure/postgres/repositories/PgStagingRepository";
import { IUnitOfWork } from "./IUnitOfWork";
import { PgUserWorkspaceRepository } from "../repositories/PgUserWorkspaceRepository";

export class UnitOfWorkFactory {
    constructor(private readonly db: any) { } // Injected db instance from PgClient

    async execute<T>(
        work: (uow: IUnitOfWork) => Promise<T>
    ): Promise<T> {
        return this.db.transaction(async (tx: any) => {
            return work({
                products: new PgProductRepository(tx),
                embeddings: new PgEmbeddingRepository(tx),
                credentials: new PgCredentialRepository(tx),
                customers: new PgCustomerRepository(tx),
                orders: new PgOrderRepository(tx),
                orderLineItems: new PgOrderLineItemRepository(tx),
                users: new PgUserRepository(tx),
                organizations: new PgOrganizationRepository(tx),
                stores: new PgStoreRepository(tx),
                userWorkspaces: new PgUserWorkspaceRepository(tx),
                syncJobs: new PgSyncJobRepository(tx),
                staging: new PgStagingRepository(tx),
            });
        });
    }
}
