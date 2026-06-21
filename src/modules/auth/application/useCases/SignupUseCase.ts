import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";
import { UnitOfWorkFactory } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";
import { OnboardingData } from "../../domain/services/AuthOnboardingService";
import { AuthOrchestrator } from "../orchestrator/AuthOrchestrator";
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

export class SignupUseCase {
    private readonly orchestrator: AuthOrchestrator;

    constructor(private readonly uowFactory: UnitOfWorkFactory) {
        this.orchestrator = new AuthOrchestrator();
    }

    async execute(input: SignupInput): Promise<SignupOutput> {
        return this.uowFactory.execute(async (uow: IUnitOfWork) => {
            // 1. Ensure email not already taken
            const existing = await uow.users.findByEmail(input.adminEmail);
            if (existing) {
                throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
            }

            // 2. Delegate to Orchestrator
            return this.orchestrator.signUp(uow, input);
        });
    }
}
