// application/useCases/internal/GetInternalCredentialsUseCase.ts
import { Vault } from "src/libs/shared/crypto/vault";
import { UnitOfWorkFactory } from "src/libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export interface InternalCredentialsOutput {
    accessToken: string;
    webhookSecret: string;
    shopDomain: string;
    apiVersion: string;
}

export class GetInternalCredentialsUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) {}

    async execute(storeId: string): Promise<InternalCredentialsOutput | null> {
        const cred = await this.uowFactory.execute(async (uow) =>
            uow.credentials.findByStoreId(storeId)
        );

        if (!cred) return null;

        const { accessToken, webhookSecret } = JSON.parse(
            Vault.decrypt(cred.encryptedCredentials)
        );

        return {
            accessToken,
            webhookSecret,
            shopDomain: cred.shopDomain,
            apiVersion: cred.apiVersion,
        };
    }
}