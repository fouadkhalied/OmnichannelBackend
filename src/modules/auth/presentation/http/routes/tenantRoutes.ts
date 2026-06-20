import { Router } from "express";
import { TenantRegisterController } from "../controllers/TenantRegisterController";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export function createTenantRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const controller = new TenantRegisterController(uowFactory);

    // POST /api/tenants/register
    router.post("/register", controller.register.bind(controller));

    return router;
}
