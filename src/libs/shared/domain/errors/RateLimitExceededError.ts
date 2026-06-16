import { BaseError } from "./BaseError";

export class RateLimitExceededError extends BaseError {
    constructor(message = "Rate limit exceeded") {
        super(429, message, "RATE_LIMIT_EXCEEDED");
    }
}
