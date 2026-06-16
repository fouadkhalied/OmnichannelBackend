import { BaseError } from "./BaseError";

export class UnauthorizedError extends BaseError {
    constructor(message = "Unauthorized") {
        super(401, message, "UNAUTHORIZED");
    }
}
