import { BaseError } from "./BaseError";

export class ValidationError extends BaseError {
    constructor(message = "Validation failed") {
        super(422, message, "VALIDATION_FAILED");
    }
}
