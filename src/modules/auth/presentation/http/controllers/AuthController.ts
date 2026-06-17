import { Request, Response } from "express";
import { z } from "zod";
import { signupUseCase } from "../../../application/useCases/SignupUseCase";
import { loginUseCase } from "../../../application/useCases/LoginUseCase";
import { logoutUseCase } from "../../../application/useCases/LogoutUseCase";

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    displayName: z.string().optional(),
    organizationName: z.string().min(1, "Organization name is required"),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export class AuthController {
    async signup(req: Request, res: Response): Promise<void> {
        const parsed = signupSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
            return;
        }

        try {
            const result = await signupUseCase(parsed.data);
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
            const result = await loginUseCase(parsed.data);
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
        // req.userId and req.user are set by AuthMiddleware
        const user = (req as any).user;
        res.status(200).json({
            userId: (req as any).userId,
            organizationId: user?.claims?.organizationId,
            storeId: user?.claims?.storeId,
        });
    }
}
