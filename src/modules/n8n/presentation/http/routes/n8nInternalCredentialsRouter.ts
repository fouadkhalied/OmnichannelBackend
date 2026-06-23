import { Router } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { InternalSecretMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/InternalSecretMiddleware";
import { InternalCredentialsController } from "../controllers/InternalCredentialsController";
import { LoggerMiddleware } from "src/libs/shared/presentation/http/middleware/foundational/LoggerMiddleware";
import { createTenantMiddleware } from "src/libs/shared/presentation/http/middleware/security/TenantMiddleware";
import { AuthMiddleware } from "src/libs/shared/presentation/http/middleware/security/AuthMiddleware";

export function createInternalCredentialsRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const controller = new InternalCredentialsController(uowFactory);
    const tenantMiddleware = createTenantMiddleware(uowFactory);

    router.get("/credentials/by-domain/:shopDomain",
        InternalSecretMiddleware,
        (req, res) => controller.getCredentialsByDomain(req, res)
    );

    router.post("/credentials/attach-phone",
        AuthMiddleware,
        tenantMiddleware,
        LoggerMiddleware,
        (req, res) => controller.attachPhoneNumber(req, res)
    );

    return router;
}
