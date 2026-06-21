import { AuthOrchestrator } from "../orchestrator/AuthOrchestrator";
import { UnitOfWorkFactory } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";

export interface LoginInput {
    email: string;
    password: string;
}

export interface LoginOutput {
    token: string;
    user: {
        id: string;
        email: string;
        organizationId: string;
        storeId: string;
        role: string;
    };
}

export class LoginUseCase {
    private readonly orchestrator: AuthOrchestrator;

    constructor(private readonly uowFactory: UnitOfWorkFactory) {
        this.orchestrator = new AuthOrchestrator();
    }

    async execute(input: LoginInput): Promise<LoginOutput> {
        return this.uowFactory.execute(async (uow: IUnitOfWork) => {
            return this.orchestrator.signIn(uow, input);
        });
    }
}
