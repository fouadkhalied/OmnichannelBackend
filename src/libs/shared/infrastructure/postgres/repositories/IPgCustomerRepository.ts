import { Customer, NewCustomer } from "../schema/customers";

export interface IPgCustomerRepository {
    upsert(input: NewCustomer): Promise<Customer>;
    findById(id: string): Promise<Customer | null>;
    findByShopifyId(storeId: string, shopifyId: string): Promise<Customer | null>;
}
