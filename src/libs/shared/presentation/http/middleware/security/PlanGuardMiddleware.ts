import { Request, Response, NextFunction } from "express";
import { PlanUpgradeError } from "../../../../domain/errors/PlanUpgradeError";

export const PlanGuardMiddleware = (requiredPlan: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // const plan = req.tenantContext?.plan;
        // if (!plan || plan !== requiredPlan) {
        //     return next(new PlanUpgradeError());
        // }
        next();
    };
};
