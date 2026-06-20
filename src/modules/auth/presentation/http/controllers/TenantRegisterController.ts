import { Request, Response } from "express";
import { AuthOnboardingService } from "../../../domain/services/AuthOnboardingService";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";
import { logger } from "../../../../../libs/common/logger";
import { env } from "../../../../../config/env";
import jwt from "jsonwebtoken";

export class TenantRegisterController {
    private readonly onboardingService = new AuthOnboardingService();

    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async register(req: Request, res: Response) {
        // Set headers for streaming
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Connection', 'keep-alive');

        const sendProgress = (message: string) => {
            const chunk = JSON.stringify({ type: 'progress', message }) + "\n";
            res.write(chunk);
        };

        try {
            logger.info("tenant.registration_request_received", { email: req.body.adminEmail });

            const result = await this.uowFactory.execute(async (uow: IUnitOfWork) => {
                const onboardingResult = await this.onboardingService.onboard(uow, req.body, sendProgress);

                // Issue JWT (Step 14)
                const token = jwt.sign(
                    {
                        tenant_id: onboardingResult.tenantId,
                        admin_email: req.body.adminEmail,
                        plan: req.body.plan ?? "free",
                        role: "admin"
                    },
                    env.SESSION_SECRET!,
                    { expiresIn: "15m" }
                );

                return { ...onboardingResult, token };
            });

            res.write(JSON.stringify({ type: 'success', data: result }) + "\n");
            res.end();
        } catch (err: any) {
            logger.error("tenant.registration_failed", { error: err.message, stack: err.stack });
            res.write(JSON.stringify({ type: 'error', message: err.message }) + "\n");
            res.end();
        }
    }
}
