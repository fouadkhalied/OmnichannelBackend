import { SQL, and, eq } from "drizzle-orm";

export abstract class BaseRepository {
    constructor() { }

    /**
     * Enforces tenant scoping on any condition
     */
    protected withTenant(tenantId: string, condition?: SQL): SQL {
        const tenantFilter = eq((this as any).table.tenantId, tenantId);
        return condition ? and(tenantFilter, condition)! : tenantFilter;
    }
}
