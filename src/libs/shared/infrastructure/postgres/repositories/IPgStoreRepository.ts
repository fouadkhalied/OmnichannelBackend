import { Store, NewStore } from "../schema/stores";

export interface IPgStoreRepository {
    upsert(input: NewStore): Promise<Store>;
    findById(id: string): Promise<Store | null>;
    findByOrganizationId(organizationId: string): Promise<Store[]>;
    delete(id: string): Promise<void>;
}
