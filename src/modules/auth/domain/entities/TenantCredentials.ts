export class TenantCredentials {
    constructor(
        public readonly id: string,
        public readonly organizationId: string,
        public readonly n8nApiKeyEncrypted: string,
        public readonly n8nWebhookSecretEnc: string,
        public readonly n8nEncryptionKeyEnc: string | null,
        public readonly iv: string,
        public readonly n8nBaseUrl: string | null,
        public readonly plan: string,
        public readonly vectorDbUrl: string | null,
        public readonly createdAt?: Date,
        public readonly updatedAt?: Date,
    ) { }
}
