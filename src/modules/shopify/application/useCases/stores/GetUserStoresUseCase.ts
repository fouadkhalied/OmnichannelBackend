import { UnitOfWorkFactory } from "src/libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export interface UserStoreOutput {
    id: string;
    name: string;
}

export class GetUserStoresUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async execute(userId: string): Promise<UserStoreOutput[]> {
        return this.uowFactory.execute(async (uow) => {
            // 1. Find all organizations the user belongs to
            const workspaces = await uow.userWorkspaces.findByUserId(userId);
            const organizationIds = [...new Set(workspaces.map(w => w.organizationId))];

            if (organizationIds.length === 0) {
                return [];
            }

            // 2. Find all stores in those organizations
            const allStores = [];
            for (const orgId of organizationIds) {
                const orgStores = await uow.stores.findByOrganizationId(orgId);
                allStores.push(...orgStores);
            }

            // 3. Deduplicate (just in case) and map to id/name
            const uniqueStoresMap = new Map<string, UserStoreOutput>();
            for (const store of allStores) {
                if (!uniqueStoresMap.has(store.id)) {
                    uniqueStoresMap.set(store.id, {
                        id: store.id,
                        name: store.name,
                    });
                }
            }

            return Array.from(uniqueStoresMap.values());
        });
    }
}
