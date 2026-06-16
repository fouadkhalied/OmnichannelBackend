import { Request, Response, NextFunction } from "express";
import { ValidationError } from "../../../../domain/errors/ValidationError";

export const ValidationMiddleware = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Mocking Zod validation
            console.log("Validating request...");
            next();
        } catch (error: any) {
            next(new ValidationError(error.message));
        }
    };
};
