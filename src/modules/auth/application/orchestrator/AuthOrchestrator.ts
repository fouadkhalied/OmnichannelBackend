import crypto from "crypto";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";
import { hashPassword, verifyPassword } from "../../../../libs/shared/crypto/password";
import { TenantPlan } from "../../../../libs/shared/domain/valueObjects/TenantContext";
import { TokenService } from "../services/TokenService";

export interface AuthUser {
    id: string;
    email: string;
    organizationId: string;
    storeId: string;
    role: string;
}

export interface AuthResult {
    token: string;
    user: AuthUser;
}

export class AuthOrchestrator {
    private readonly tokenService: TokenService;

    constructor() {
        this.tokenService = new TokenService();
    }

    async signUp(uow: IUnitOfWork, data: any): Promise<AuthResult> {
        // 1. Hash password
        const hashedPassword = await hashPassword(data.adminPassword);

        // 2. Create Organization
        const organizationId = crypto.randomUUID();
        await uow.organizations.upsert({
            id: organizationId,
            name: data.companyName,
            plan: data.plan ?? TenantPlan.FREE,
        });

        // 3. Create User
        const userId = crypto.randomUUID();
        await uow.users.upsert({
            id: userId,
            email: data.adminEmail,
            passwordHash: hashedPassword,
            role: "user",
            isActivated: true,
        });

        // 4. Create Tenant record
        await uow.tenants.upsert({
            id: userId,
            companyName: data.companyName,
            email: data.adminEmail,
            passwordHash: hashedPassword,
            plan: data.plan ?? TenantPlan.FREE,
            isActive: true,
        });

        // 5. Create Store
        const storeId = crypto.randomUUID();
        await uow.stores.upsert({
            id: storeId,
            organizationId,
            name: data.companyName,
            platform: "shopify",
            storeUrl: data.shopDomain,
        });

        // 6. Link User to Organization
        await uow.userWorkspaces.upsert({
            userId,
            organizationId,
            storeId,
            role: "user",
        });

        // 7. Issue JWT
        const token = await this.tokenService.generateToken({
            sub: userId,
            organizationId,
            storeId,
        });

        return {
            token,
            user: {
                id: userId,
                email: data.adminEmail,
                organizationId,
                storeId,
                role: "user",
            },
        };
    }

    async signIn(uow: IUnitOfWork, data: any): Promise<AuthResult> {
        // 1. Find user
        const user = await uow.users.findByEmail(data.email);
        if (!user || !user.passwordHash) {
            throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
        }

        // 2. Verify password
        const valid = await verifyPassword(data.password, user.passwordHash);
        if (!valid) {
            throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
        }

        // 3. Fetch associated organization and store
        const workspaces = await uow.userWorkspaces.findByUserId(user.id);
        if (!workspaces || workspaces.length === 0) {
            throw new Error("User has no associated organizations.");
        }

        const organizationId = workspaces[0].organizationId;
        const stores = await uow.stores.findByOrganizationId(organizationId);
        const storeId = stores.length > 0 ? stores[0].id : "";

        // 4. Issue JWT
        const token = await this.tokenService.generateToken({
            sub: user.id,
            organizationId,
            storeId,
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                organizationId,
                storeId,
                role: user.role,
            },
        };
    }
}
