import { Router } from "express";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { createInternalCredentialsRouter } from "./n8nInternalCredentialsRouter";

export function createN8nRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();

    // Internal routes for n8n
    router.use("/internal", createInternalCredentialsRouter(uowFactory));

    return router;
}
