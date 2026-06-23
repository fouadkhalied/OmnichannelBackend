import { Vault } from "src/libs/shared/crypto/vault";
import { UnitOfWorkFactory } from "src/libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { InternalCredentialsOutput } from "./GetInternalCredentialsUseCase";

export class GetInternalCredentialsByDomainUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async execute(shopDomain: string): Promise<InternalCredentialsOutput | null> {
        const cred = await this.uowFactory.execute(async (uow) =>
            uow.credentials.findByShopDomain(shopDomain)
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
            phoneNumberId: cred.phoneNumberId,
        };
    }
}
