import { Request, Response } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { GetInternalCredentialsUseCase } from "../../../application/useCases/GetInternalCredentialsUseCase";
import { GetInternalCredentialsByDomainUseCase } from "../../../application/useCases/GetInternalCredentialsByDomainUseCase";
import { AttachPhoneNumberUseCase } from "../../../application/useCases/AttachPhoneNumberUseCase";

export class InternalCredentialsController {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async getCredentials(req: Request, res: Response): Promise<void> {
        try {
            const useCase = new GetInternalCredentialsUseCase(this.uowFactory);
            const storeId = req.params.storeId;

            if (!storeId) {
                res.status(400).json({ error: "Store ID is required" });
                return;
            }
            const result = await useCase.execute(storeId.toString());

            if (!result) {
                res.status(404).json({ error: "Not found" });
                return;
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: "Failed to retrieve credentials" });
        }
    }

    async getCredentialsByDomain(req: Request, res: Response): Promise<void> {
        try {
            const useCase = new GetInternalCredentialsByDomainUseCase(this.uowFactory);
            const shopDomain = req.params.shopDomain;

            if (!shopDomain) {
                res.status(400).json({ error: "Shop domain is required" });
                return;
            }

            const result = await useCase.execute(shopDomain.toString());

            if (!result) {
                res.status(404).json({ error: "Not found" });
                return;
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: "Failed to retrieve credentials" });
        }
    }

    async attachPhoneNumber(req: Request, res: Response): Promise<void> {
        try {
            const { storeId, phoneNumberId } = req.body;

            if (!storeId || !phoneNumberId) {
                res.status(400).json({ error: "storeId and phoneNumberId are required" });
                return;
            }

            const useCase = new AttachPhoneNumberUseCase(this.uowFactory);
            await useCase.execute(storeId, phoneNumberId);

            res.json({ message: "Phone number attached successfully" });
        } catch (error: any) {
            res.status(500).json({ error: error.message || "Failed to attach phone number" });
        }
    }
}