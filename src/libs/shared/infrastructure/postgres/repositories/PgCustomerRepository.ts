import { eq, and } from "drizzle-orm";
import { customers, Customer, NewCustomer } from "../schema/customers";
import { IPgCustomerRepository } from "./IPgCustomerRepository";

export class PgCustomerRepository implements IPgCustomerRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewCustomer): Promise<Customer> {
        const [result] = await this.db
            .insert(customers)
            .values(input)
            .onConflictDoUpdate({
                target: [customers.storeId, customers.shopifyId],
                set: {
                    email: input.email,
                    phone: input.phone,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    ordersCount: input.ordersCount,
                    totalSpent: input.totalSpent,
                    tags: input.tags,
                    data: input.data,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<Customer | null> {
        const [result] = await this.db
            .select()
            .from(customers)
            .where(eq(customers.id, id))
            .limit(1);
        return result || null;
    }

    async findByShopifyId(storeId: string, shopifyId: string): Promise<Customer | null> {
        const [result] = await this.db
            .select()
            .from(customers)
            .where(and(eq(customers.storeId, storeId), eq(customers.shopifyId, shopifyId)))
            .limit(1);
        return result || null;
    }
}
