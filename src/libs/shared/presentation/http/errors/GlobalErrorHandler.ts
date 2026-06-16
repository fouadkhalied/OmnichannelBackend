import { Request, Response, NextFunction } from "express";
import { BaseError } from "../../../domain/errors/BaseError";

export const GlobalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof BaseError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    console.error("Unhandle Error:", err);

    const isProduction = process.env.NODE_ENV === "production";
    res.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: isProduction ? "An unexpected error occurred" : err.message
        }
    });
};
