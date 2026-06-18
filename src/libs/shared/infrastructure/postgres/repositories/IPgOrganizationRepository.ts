import { Organization, NewOrganization } from "../schema/organizations";

export interface IPgOrganizationRepository {
    upsert(input: NewOrganization): Promise<Organization>;
    findById(id: string): Promise<Organization | null>;
    delete(id: string): Promise<void>;
}
