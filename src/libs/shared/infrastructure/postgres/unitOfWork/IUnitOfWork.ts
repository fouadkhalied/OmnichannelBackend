import { IPgProductRepository } from "../repositories/IPgProductRepository";
import { IPgEmbeddingRepository } from "../repositories/IPgEmbeddingRepository";
import { IPgCredentialRepository } from "../repositories/IPgCredentialRepository";
import { IPgCustomerRepository } from "../repositories/IPgCustomerRepository";
import { IPgOrderRepository } from "../repositories/IPgOrderRepository";
import { IPgOrderLineItemRepository } from "../repositories/IPgOrderLineItemRepository";
import { IPgUserRepository } from "../repositories/IPgUserRepository";
import { IPgOrganizationRepository } from "../repositories/IPgOrganizationRepository";
import { IPgStoreRepository } from "../repositories/IPgStoreRepository";
import { ISyncJobRepository } from "../../../../../modules/shopify/domain/repositories/ISyncJobRepository";
import { IStagingRepository } from "../../../../../modules/shopify/domain/repositories/IStagingRepository";
import { IPgUserWorkspaceRepository } from "../repositories/IPgUserWorkspaceRepository";
import { ITenantRepository } from "../../../../../modules/auth/domain/repositories/ITenantRepository";
import { ITenantN8nRepository } from "../../../../../modules/auth/domain/repositories/ITenantN8nRepository";
import { ITenantSyncLogRepository } from "../../../../../modules/auth/domain/repositories/ITenantSyncLogRepository";

export interface IUnitOfWork {
    products: IPgProductRepository;
    embeddings: IPgEmbeddingRepository;
    credentials: IPgCredentialRepository;
    customers: IPgCustomerRepository;
    orders: IPgOrderRepository;
    orderLineItems: IPgOrderLineItemRepository;
    users: IPgUserRepository;
    organizations: IPgOrganizationRepository;
    stores: IPgStoreRepository;
    userWorkspaces: IPgUserWorkspaceRepository;
    syncJobs: ISyncJobRepository;
    staging: IStagingRepository;
    tenants: ITenantRepository;
    tenantN8n: ITenantN8nRepository;
    tenantSyncLogs: ITenantSyncLogRepository;
}
