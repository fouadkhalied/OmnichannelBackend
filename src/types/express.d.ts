import { TenantContext } from "../libs/shared/domain/valueObjects/TenantContext";

declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
            userId?: string;
            jti?: string;
        }
    }
}


