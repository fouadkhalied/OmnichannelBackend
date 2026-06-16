import { AsyncLocalStorage } from "async_hooks";
import type { Request } from "express";
import { AppUserModel, StoreModel } from "@shared/infrastructure/mongo/models";
import { TenantContext } from "@shared/domain/valueObjects/TenantContext";

export const DEFAULT_ORGANIZATION_ID = "org_default";
export const DEFAULT_STORE_ID = "store_default";

type AuthenticatedRequest = Request & {
    user?: {
        claims?: {
            sub?: string;
            organizationId?: string;
            storeId?: string;
        };
    };
    tenantContext?: TenantContext;
};

export class TenantResolutionError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 403) {
        super(message);
        this.statusCode = statusCode;
    }
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

const readHeader = (req: Request, key: string): string | undefined => {
    const value = req.header(key);
    if (!value) return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

const defaultTenant = (): TenantContext => ({
    tenantId: `${DEFAULT_ORGANIZATION_ID}:${DEFAULT_STORE_ID}`,
    organizationId: DEFAULT_ORGANIZATION_ID,
    storeId: DEFAULT_STORE_ID,
    plan: "free",
    features: [],
    limits: {},
});

const normalizeWorkspaceMemberships = (appUser: any): Partial<TenantContext>[] => {
    const memberships: Partial<TenantContext>[] = [];

    if (Array.isArray(appUser?.workspaces)) {
        for (const workspace of appUser.workspaces) {
            const organizationId = typeof workspace?.organizationId === "string" ? workspace.organizationId.trim() : "";
            const storeId = typeof workspace?.storeId === "string" ? workspace.storeId.trim() : "";
            if (!organizationId || !storeId) continue;
            memberships.push({ organizationId, storeId, tenantId: `${organizationId}:${storeId}` });
        }
    }

    if (typeof appUser?.organizationId === "string") {
        const organizationId = appUser.organizationId.trim();
        const storeId = typeof appUser?.storeId === "string" && appUser.storeId.trim() ? appUser.storeId.trim() : "";
        if (organizationId && storeId) {
            memberships.push({
                organizationId,
                storeId,
                tenantId: `${organizationId}:${storeId}`
            });
        }
    }

    const deduped = new Map<string, Partial<TenantContext>>();
    for (const membership of memberships) {
        deduped.set(`${membership.organizationId}:${membership.storeId}`, membership);
    }
    return Array.from(deduped.values());
};

const resolveTenantFromHeaders = (req: Request): TenantContext => {
    const organizationId = readHeader(req, "x-organization-id") ?? DEFAULT_ORGANIZATION_ID;
    const storeId = readHeader(req, "x-store-id") ?? DEFAULT_STORE_ID;
    return {
        tenantId: `${organizationId}:${storeId}`,
        organizationId,
        storeId,
        plan: "free",
        features: [],
        limits: {},
    };
};

export const runWithTenantContext = <T>(tenant: TenantContext, callback: () => T): T =>
    tenantStorage.run(tenant, callback);

export const getRuntimeTenantContext = (): TenantContext | null => tenantStorage.getStore() ?? null;

export const getRuntimeTenantContextOrDefault = (): TenantContext =>
    getRuntimeTenantContext() ?? defaultTenant();

export const resolveTenantContext = async (req: AuthenticatedRequest): Promise<TenantContext> => {
    const userId = req.user?.claims?.sub;
    if (!userId) {
        return resolveTenantFromHeaders(req);
    }

    const appUser = await AppUserModel.findOne({ id: userId }).lean();
    if (!appUser?.organizationId) {
        return resolveTenantFromHeaders(req);
    }

    const memberships = normalizeWorkspaceMemberships(appUser);
    const claimedOrganizationId = req.user?.claims?.organizationId?.trim();
    const claimedStoreId = req.user?.claims?.storeId?.trim();
    const requestedOrganizationId = readHeader(req, "x-organization-id") ?? claimedOrganizationId ?? null;
    const requestedStoreId = readHeader(req, "x-store-id");
    const hasOrganizationWideAccess =
        (!Array.isArray((appUser as any).workspaces) || (appUser as any).workspaces.length === 0) &&
        Boolean(appUser.organizationId) &&
        !appUser.storeId;

    let resolved: Partial<TenantContext> | undefined;

    if (requestedStoreId) {
        const membership = memberships.find(
            (entry) =>
                entry.storeId === requestedStoreId &&
                (!requestedOrganizationId || entry.organizationId === requestedOrganizationId),
        );

        if (membership) {
            resolved = membership;
        } else if (!hasOrganizationWideAccess) {
            throw new TenantResolutionError("Requested store is not accessible for this workspace.", 403);
        } else {
            const organizationId = requestedOrganizationId ?? String(appUser.organizationId);
            const store = await StoreModel.findOne({
                id: requestedStoreId,
                organizationId,
            }).lean();

            if (!store) {
                throw new TenantResolutionError("Requested store is not accessible for this workspace.", 403);
            }

            resolved = {
                organizationId,
                storeId: String(store.id),
                tenantId: `${organizationId}:${store.id}`
            };
        }
    } else if (requestedOrganizationId) {
        const organizationWorkspace = memberships.find(
            (entry) => entry.organizationId === requestedOrganizationId,
        );

        if (organizationWorkspace) {
            resolved = organizationWorkspace;
        } else if (!hasOrganizationWideAccess || requestedOrganizationId !== String(appUser.organizationId)) {
            throw new TenantResolutionError("Requested workspace is not accessible for this user.", 403);
        } else {
            resolved = {
                organizationId: requestedOrganizationId,
                storeId: DEFAULT_STORE_ID,
                tenantId: `${requestedOrganizationId}:${DEFAULT_STORE_ID}`
            };
        }
    } else if (claimedOrganizationId && claimedStoreId) {
        const claimedWorkspace = memberships.find(
            (entry) =>
                entry.organizationId === claimedOrganizationId &&
                entry.storeId === claimedStoreId,
        );
        if (claimedWorkspace) {
            resolved = claimedWorkspace;
        }
    }

    if (!resolved && memberships.length > 0) {
        resolved = {
            organizationId: memberships[0].organizationId,
            storeId: memberships[0].storeId,
            tenantId: `${memberships[0].organizationId}:${memberships[0].storeId}`
        };
    }

    if (!resolved) {
        const organizationId = String(appUser.organizationId);
        const storeId = appUser.storeId ? String(appUser.storeId) : DEFAULT_STORE_ID;
        resolved = {
            organizationId,
            storeId,
            tenantId: `${organizationId}:${storeId}`
        };
    }

    return {
        ...defaultTenant(),
        ...resolved,
        tenantId: resolved.tenantId!,
        organizationId: resolved.organizationId!,
        storeId: resolved.storeId!,
    };
};

export const getTenantContext = (req: AuthenticatedRequest): TenantContext =>
    req.tenantContext ?? getRuntimeTenantContext() ?? resolveTenantFromHeaders(req);
