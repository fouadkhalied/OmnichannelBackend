import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";
import { UnitOfWorkFactory } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";
import { AuthOnboardingService, OnboardingData } from "../../domain/services/AuthOnboardingService";
import { logger } from "../../../../libs/common/logger";

export interface SignupInput extends OnboardingData { }

export interface SignupOutput {
    token: string;
    user: {
        id: string;
        email: string;
        organizationId: string;
        storeId: string;
    };
}

const JWT_SECRET = env.SESSION_SECRET;
const TOKEN_TTL_S = 60 * 60 * 24 * 7; // 7 days

export class SignupUseCase {
    private readonly onboardingService: AuthOnboardingService;

    constructor(private readonly uowFactory: UnitOfWorkFactory) {
        this.onboardingService = new AuthOnboardingService();
    }

    async execute(input: SignupInput): Promise<SignupOutput> {
        return this.uowFactory.execute(async (uow: IUnitOfWork) => {
            // 1. Ensure email not already taken
            const existing = await uow.users.findByEmail(input.adminEmail);
            if (existing) {
                throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
            }

            // 2. Orchestrate onboarding via Domain Service
            const { tenantId } = await this.onboardingService.onboard(uow, input, (status) => {
                logger.info(`[Onboarding Progress]: ${status}`);
            });

            const userId = tenantId;
            const organizationId = tenantId;
            const storeId = input.shopDomain;

            // 3. Issue JWT
            const jti = crypto.randomUUID();
            const expiresAt = Date.now() + TOKEN_TTL_S * 1000;
            const token = jwt.sign(
                { sub: userId, jti, organizationId, storeId },
                JWT_SECRET,
                { expiresIn: TOKEN_TTL_S }
            );

            JtiStore.set(jti, userId, expiresAt);

            return {
                token,
                user: { id: userId, email: input.adminEmail, organizationId, storeId },
            };
        });
    }
}
