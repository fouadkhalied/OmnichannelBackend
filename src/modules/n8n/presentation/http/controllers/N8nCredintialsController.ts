// presentation/http/controllers/InternalCredentialsController.ts

import { Request, Response } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { GetInternalCredentialsUseCase } from "src/modules/n8n/application/useCases/GetInternalCredentialsUseCase";

export class InternalCredentialsController {
    constructor(private readonly uowFactory: UnitOfWorkFactory) {}

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
}