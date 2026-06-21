import { z } from "zod";
import { TenantPlan } from "../../../../../libs/shared/domain/valueObjects/TenantContext";

export const signupSchema = z.object({
    adminEmail: z.string().email("Invalid email address"),
    adminPassword: z.string().min(8, "Password must be at least 8 characters"),
    companyName: z.string().min(1, "Company name is required"),
    shopDomain: z.string().min(1, "Shop domain is required"),
    plan: z.nativeEnum(TenantPlan).optional(),
});

export type SignupRequest = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
