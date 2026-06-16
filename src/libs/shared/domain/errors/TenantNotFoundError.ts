import { BaseError } from "./BaseError";

export class TenantNotFoundError extends BaseError {
    constructor(message = "Tenant not found") {
        super(404, message, "TENANT_NOT_FOUND");
    }
}
