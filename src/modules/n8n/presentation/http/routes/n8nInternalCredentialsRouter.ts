import { Router } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { InternalSecretMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/InternalSecretMiddleware";
import { InternalCredentialsController } from "../controllers/InternalCredentialsController";

export function createInternalCredentialsRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const controller = new InternalCredentialsController(uowFactory);

    router.get("/credentials/by-domain/:shopDomain",
        InternalSecretMiddleware,
        (req, res) => controller.getCredentialsByDomain(req, res)
    );

    router.post("/credentials/attach-phone",
        InternalSecretMiddleware,
        (req, res) => controller.attachPhoneNumber(req, res)
    );

    return router;
}
