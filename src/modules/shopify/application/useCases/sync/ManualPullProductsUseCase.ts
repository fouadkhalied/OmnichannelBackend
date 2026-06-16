import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";

export class ManualPullProductsUseCase extends BaseService {
    constructor(tenantContext: TenantContext) {
        super(tenantContext);
    }

    async execute(): Promise<void> {
        // Implementation pending
    }
}
