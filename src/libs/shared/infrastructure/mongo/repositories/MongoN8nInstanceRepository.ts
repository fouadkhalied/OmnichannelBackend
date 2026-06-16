import { N8nInstanceModel } from "../models/index";
import {
    IN8nInstanceRepository,
    N8nInstance,
} from "src/modules/shopify/domain/repositories/IN8nInstanceRepository";

export class MongoN8nInstanceRepository implements IN8nInstanceRepository {
    async findByOrganizationId(organizationId: string): Promise<N8nInstance | null> {
        const doc = await N8nInstanceModel.findOne({ organizationId }).lean();
        if (!doc) return null;

        return {
            id: doc.id,
            organizationId: doc.organizationId,
            n8nSpaceUrl: doc.n8nSpaceUrl,
            n8nApiKeyEnc: doc.n8nApiKeyEnc,
            n8nWebhookSecret: doc.n8nWebhookSecret,
            status: doc.status as any,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }

    async upsert(instance: N8nInstance): Promise<void> {
        await N8nInstanceModel.updateOne(
            { organizationId: instance.organizationId },
            {
                $set: {
                    ...instance,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true },
        );
    }
}
