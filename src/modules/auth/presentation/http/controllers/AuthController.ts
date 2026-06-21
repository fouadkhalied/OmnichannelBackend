import { Request, Response } from "express";
import { z } from "zod";
import { SignupUseCase } from "../../../application/useCases/SignupUseCase";
import { LoginUseCase } from "../../../application/useCases/LoginUseCase";
import { logoutUseCase } from "../../../application/useCases/LogoutUseCase";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { TenantPlan } from "../../../../../libs/shared/domain/valueObjects/TenantContext";

const signupSchema = z.object({
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8, "Password must be at least 8 characters"),
    companyName: z.string().min(1, "Company name is required"),
    shopDomain: z.string().url("Must be a valid URL"),
    shopifyAppClientId: z.string().min(1, "Shopify App Client ID is required"),
    shopifyAppClientSecret: z.string().min(1, "Shopify App Client Secret is required"),
    neonConnectionString: z.string().min(1, "Neon connection string is required"),
    openaiApiKey: z.string().min(1, "OpenAI API key is required"),
    hfToken: z.string().min(1, "Hugging Face token is required"),
    hfUsername: z.string().min(1, "Hugging Face username is required"),
    plan: z.nativeEnum(TenantPlan).optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export class AuthController {
    private readonly signupUseCase: SignupUseCase;
    private readonly loginUseCase: LoginUseCase;

    constructor(uowFactory: UnitOfWorkFactory) {
        this.signupUseCase = new SignupUseCase(uowFactory);
        this.loginUseCase = new LoginUseCase(uowFactory);
    }

    async signup(req: Request, res: Response): Promise<void> {
        const parsed = signupSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
            return;
        }

        try {
            const result = await this.signupUseCase.execute(parsed.data);
            res.status(201).json(result);
        } catch (err: any) {
            res.status(err.statusCode ?? 500).json({ error: err.message ?? "Signup failed" });
        }
    }

    async login(req: Request, res: Response): Promise<void> {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
            return;
        }

        try {
            const result = await this.loginUseCase.execute(parsed.data);
            res.status(200).json(result);
        } catch (err: any) {
            res.status(err.statusCode ?? 500).json({ error: err.message ?? "Login failed" });
        }
    }

    async logout(req: Request, res: Response): Promise<void> {
        const jti = (req as any).jti as string | undefined;
        if (jti) {
            logoutUseCase(jti);
        }
        res.status(200).json({ message: "Logged out successfully" });
    }

    async me(req: Request, res: Response): Promise<void> {
        const user = (req as any).user;
        res.status(200).json({
            userId: (req as any).userId,
            organizationId: user?.claims?.organizationId,
            storeId: user?.claims?.storeId,
        });
    }
}
