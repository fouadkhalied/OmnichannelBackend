import { ApiError } from "../api/ApiError";

export class ErrorBuilder {
    static unauthorized(message = "Unauthorized"): ApiError {
        return new ApiError(401, "UNAUTHORIZED", message);
    }

    static notFound(resource: string): ApiError {
        return new ApiError(404, "NOT_FOUND", `${resource} not found`);
    }

    static internal(message = "Internal server error"): ApiError {
        return new ApiError(500, "INTERNAL_ERROR", message);
    }
}