import { Request, Response } from "express";
import { UnitOfWorkFactory } from "@shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { GetUserStoresUseCase } from "../../../application/useCases/stores/GetUserStoresUseCase";

export class ShopifyStoreController {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async getStores(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId;

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const useCase = new GetUserStoresUseCase(this.uowFactory);
            const stores = await useCase.execute(userId);

            res.json(stores);
        } catch (error: any) {
            res.status(500).json({ error: error.message || "Failed to retrieve stores" });
        }
    }
}
