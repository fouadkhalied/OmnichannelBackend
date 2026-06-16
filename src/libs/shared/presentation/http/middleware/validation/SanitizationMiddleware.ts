import { Request, Response, NextFunction } from "express";

export const SanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Mocking sanitization logic
    console.log("Sanitizing request...");
    next();
};
