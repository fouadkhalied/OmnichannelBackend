import { AsyncLocalStorage } from "async_hooks";
import { Request } from "express";
import { TenantContext } from "@shared/domain/valueObjects/TenantContext";
import { UnitOfWorkFactory } from "@shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export class TenantResolutionError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 403,
    ) {
        super(message);
        this.name = "TenantResolutionError";
    }
}

// ─── AsyncLocalStorage store ──────────────────────────────────────────────────

const tenantStorage = new AsyncLocalStorage<TenantContext>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const readHeader = (req: Request, key: string): string | undefined => {
    const value = req.header(key)?.trim();
    return value?.length ? value : undefined;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const runWithTenantContext = <T>(tenant: TenantContext, callback: () => T): T =>
    tenantStorage.run(tenant, callback);

export const getRuntimeTenantContext = (): TenantContext | null =>
    tenantStorage.getStore() ?? null;

/**
 * Resolves the tenant context for an incoming request.
 *
 * Resolution order:
 *   1. Unauthenticated — headers only, validated against the DB.
 *   2. Authenticated   — user memberships in the DB, headers used only to
 *                        select among workspaces the user already belongs to.
 *
 * The unauthenticated path is intentionally strict: it exists for
 * machine-to-machine calls (e.g. internal services) that never carry a JWT.
 * If that path is not needed in your system, remove it entirely.
 */
export const resolveTenantContext = async (
    req: Request,
    uowFactory: UnitOfWorkFactory,
): Promise<TenantContext> => {
    const userId = req.userId;

    // ── 1. Unauthenticated path ──────────────────────────────────────────────
    //
    // SECURITY: Headers are untrusted input. We validate the store exists in
    // the DB and that it belongs to the claimed organization before returning
    // a context. Without this check any caller could fabricate a tenant.
    //
    if (!userId) {
        const organizationId = readHeader(req, "x-organization-id");
        const storeId = readHeader(req, "x-store-id");

        if (!organizationId || !storeId) {
            throw new TenantResolutionError(
                "Tenant identifiers missing in headers (x-organization-id, x-store-id).",
                400,
            );
        }

        return uowFactory.execute(async (uow) => {
            const store = await uow.stores.findById(storeId);

            if (!store || store.organizationId !== organizationId) {
                // Return 403, not 404 — don't confirm whether the store exists.
                throw new TenantResolutionError(
                    "Requested tenant could not be resolved.",
                    403,
                );
            }

            const org = await uow.organizations.findById(organizationId);
            if (!org) {
                throw new TenantResolutionError(
                    "Requested tenant could not be resolved.",
                    403,
                );
            }

            return buildContext({
                organizationId: org.id,
                storeId: store.id,
                plan: org.plan,
            });
        });
    }

    // ── 2. Authenticated path ────────────────────────────────────────────────
    //
    // SECURITY: The user may only select among workspaces they are a member of.
    // We never fall back to looking up an arbitrary store by ID — that was the
    // bug that let authenticated users access stores they don't belong to.
    //
    return uowFactory.execute(async (uow) => {
        const appUser = await uow.users.findById(userId);
        if (!appUser) {
            throw new TenantResolutionError("User not found.", 403);
        }

        const workspaces = await uow.userWorkspaces.findByUserId(userId);
        if (workspaces.length === 0) {
            throw new TenantResolutionError("User has no workspace memberships.", 403);
        }

        const requestedOrganizationId = readHeader(req, "x-organization-id");
        const requestedStoreId = readHeader(req, "x-store-id");

        let resolved: (typeof workspaces)[number] | undefined;

        if (requestedStoreId && requestedOrganizationId) {
            // Both headers present — must match exactly.
            resolved = workspaces.find(
                (w) =>
                    w.storeId === requestedStoreId &&
                    w.organizationId === requestedOrganizationId,
            );
        } else if (requestedStoreId) {
            resolved = workspaces.find((w) => w.storeId === requestedStoreId);
        } else if (requestedOrganizationId) {
            resolved = workspaces.find((w) => w.organizationId === requestedOrganizationId);
        }

        if (!resolved) {
            if (requestedStoreId || requestedOrganizationId) {
                // The user asked for something specific but doesn't have access.
                // Again, 403 rather than 404 — don't leak existence.
                throw new TenantResolutionError(
                    "Requested workspace is not accessible.",
                    403,
                );
            }

            // No header hints at all: require an explicit selection when the user
            // belongs to more than one workspace to avoid silent cross-tenant leaks.
            if (workspaces.length > 1) {
                throw new TenantResolutionError(
                    "Multiple workspaces available. Provide x-organization-id or x-store-id to select one.",
                    400,
                );
            }

            resolved = workspaces[0];
        }

        // Fetch the org so we get real plan/features/limits from the DB.
        const org = await uow.organizations.findById(resolved.organizationId);
        if (!org) {
            throw new TenantResolutionError("Organization not found.", 403);
        }

        return buildContext({
            organizationId: resolved.organizationId,
            storeId: resolved.storeId ?? "",
            plan: org.plan,
        });
    });
};

export const getTenantContext = (req: Request): TenantContext => {
    const context = req.tenantContext ?? getRuntimeTenantContext();
    if (!context) {
        throw new TenantResolutionError("No active tenant context found.", 500);
    }
    return context;
};

// ─── Private helpers ──────────────────────────────────────────────────────────

interface ContextParts {
    organizationId: string;
    storeId: string;
    plan: TenantContext["plan"];
}

const buildContext = ({ organizationId, storeId, plan }: ContextParts): TenantContext => ({
    tenantId: `${organizationId}:${storeId}`,
    organizationId,
    storeId,
    plan,
});