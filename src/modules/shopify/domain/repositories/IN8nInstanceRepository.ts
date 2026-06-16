export interface N8nInstance {
    id: string;
    organizationId: string;
    n8nSpaceUrl: string;
    n8nApiKeyEnc: string;
    n8nWebhookSecret: string;
    status: "provisioning" | "active" | "error" | "suspended";
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IN8nInstanceRepository {
    /** Finds an n8n instance associated with an organization. */
    findByOrganizationId(organizationId: string): Promise<N8nInstance | null>;

    /** Upserts an n8n instance registration. */
    upsert(instance: N8nInstance): Promise<void>;
}
