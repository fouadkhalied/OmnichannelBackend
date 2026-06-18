import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { AuthMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/AuthMiddleware";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export function createAuthRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const controller = new AuthController(uowFactory);

    // ── Public ─────────────────────────────────────────────────────────────
    // POST /api/auth/signup
    router.post("/signup", controller.signup.bind(controller));

    // POST /api/auth/login
    router.post("/login", controller.login.bind(controller));

    // ── Protected ───────────────────────────────────────────────────────────
    // POST /api/auth/logout — requires a valid JWT
    router.post("/logout", AuthMiddleware, controller.logout.bind(controller));

    // GET  /api/auth/me — returns identity from JWT
    router.get("/me", AuthMiddleware, controller.me.bind(controller));

    return router;
}
