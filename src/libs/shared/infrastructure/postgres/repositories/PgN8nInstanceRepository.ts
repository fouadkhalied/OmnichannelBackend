import { eq } from "drizzle-orm";
import { n8nInstances } from "../schema/n8nInstances";
import {
    IN8nInstanceRepository,
    N8nInstance,
} from "src/modules/shopify/domain/repositories/IN8nInstanceRepository";

export class PgN8nInstanceRepository implements IN8nInstanceRepository {
    constructor(private readonly db: any) { }

    async findByOrganizationId(organizationId: string): Promise<N8nInstance | null> {
        const [row] = await this.db
            .select()
            .from(n8nInstances)
            .where(eq(n8nInstances.organizationId, organizationId as any))
            .limit(1);

        if (!row) return null;

        return {
            id: row.id,
            organizationId: row.organizationId,
            n8nSpaceUrl: row.n8nSpaceUrl,
            n8nApiKeyEnc: row.n8nApiKeyEnc,
            n8nWebhookSecret: row.n8nWebhookSecret,
            status: row.status as any,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async upsert(instance: N8nInstance): Promise<void> {
        await this.db
            .insert(n8nInstances)
            .values({
                id: instance.id as any,
                organizationId: instance.organizationId as any,
                n8nSpaceUrl: instance.n8nSpaceUrl,
                n8nApiKeyEnc: instance.n8nApiKeyEnc,
                n8nWebhookSecret: instance.n8nWebhookSecret,
                status: instance.status,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: n8nInstances.id,
                set: {
                    organizationId: instance.organizationId as any,
                    n8nSpaceUrl: instance.n8nSpaceUrl,
                    n8nApiKeyEnc: instance.n8nApiKeyEnc,
                    n8nWebhookSecret: instance.n8nWebhookSecret,
                    status: instance.status,
                    updatedAt: new Date(),
                },
            });
    }
}
