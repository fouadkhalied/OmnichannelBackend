import { Router, Request, Response } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { Vault } from "../../../../../libs/shared/crypto/vault";
import { InternalSecretMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/InternalSecretMiddleware";

export function createInternalCredentialsRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();

    router.get("/credentials/:storeId",
        InternalSecretMiddleware,
        async (req: Request, res: Response) => {
            try {
                const cred = await uowFactory.execute(async (uow) =>
                    uow.credentials.findByStoreId(req.params.storeId as string)
                );

                if (!cred) {
                    res.status(404).json({ error: "Not found" });
                    return;
                }

                const { accessToken, webhookSecret } = JSON.parse(
                    Vault.decrypt(cred.encryptedCredentials)
                );

                res.json({
                    accessToken,
                    shopDomain: cred.shopDomain,
                    apiVersion: cred.apiVersion,
                    webhookSecret,
                });
            } catch (error) {
                res.status(500).json({ error: "Failed to retrieve credentials" });
            }
        }
    );

    return router;
}
