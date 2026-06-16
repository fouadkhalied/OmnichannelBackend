export abstract class BaseError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly message: string,
        public readonly code: string
    ) {
        super(message);
        Object.setPrototypeOf(this, BaseError.prototype);
    }
}
