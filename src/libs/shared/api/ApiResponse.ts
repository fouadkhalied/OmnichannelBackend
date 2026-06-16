import { Response } from "express";

export class ApiResponse {
    static success<T>(res: Response, data: T, status = 200): void {
        res.status(status).json({ success: true, data });
    }

    static accepted<T>(res: Response, data: T): void {
        this.success(res, data, 202);
    }

    static error(res: Response, status: number, code: string, message: string): void {
        res.status(status).json({ success: false, error: { code, message } });
    }
}