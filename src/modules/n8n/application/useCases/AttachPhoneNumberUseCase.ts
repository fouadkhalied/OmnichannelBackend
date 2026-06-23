import { UnitOfWorkFactory } from "src/libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export class AttachPhoneNumberUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async execute(storeId: string, phoneNumberId: string): Promise<void> {
        await this.uowFactory.execute(async (uow) => {
            const cred = await uow.credentials.findByStoreId(storeId);
            if (!cred) {
                throw new Error("Credentials not found for store");
            }

            await uow.credentials.upsert({
                ...cred,
                phoneNumberId,
                updatedAt: new Date(),
            });
        });
    }
}
