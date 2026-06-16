import { BaseError } from "./BaseError";

export class PlanUpgradeError extends BaseError {
    constructor(message = "Plan upgrade required") {
        super(403, message, "PLAN_UPGRADE_REQUIRED");
    }
}
