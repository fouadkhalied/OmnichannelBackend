import { describe, it, expect, vi } from "vitest";
import { RunSyncJobUseCase } from "../src/modules/shopify/application/useCases/sync/RunSyncJobUseCase";
import { TenantContext } from "../src/libs/shared/domain/valueObjects/TenantContext";
import { ShopifySyncJob } from "../src/modules/shopify/domain/entities/ShopifySyncJob";

describe("RunSyncJobUseCase", () => {
    it("should update fullCursor in place and call saveCursor with all cursors", async () => {
        const mockStagingRepo: any = {
            getCursor: vi.fn().mockResolvedValue({ productsCursor: "p_old", customersCursor: null, ordersCursor: null }),
            saveCursor: vi.fn().mockResolvedValue(undefined),
            findByExternalId: vi.fn().mockResolvedValue(null),
            upsert: vi.fn(),
            countPendingByTenant: vi.fn().mockResolvedValue({ embedPending: 0, enrichPending: 0 })
        };
        const mockShopifyClient: any = {
            fetchProducts: vi.fn().mockResolvedValue({ items: [], nextCursor: "p_new", hasNextPage: false }),
            fetchCustomers: vi.fn().mockResolvedValue({ items: [], nextCursor: "c_new", hasNextPage: false }),
            fetchOrders: vi.fn().mockResolvedValue({ items: [], nextCursor: "o_new", hasNextPage: false }),
        };
        const mockConnectorRepo: any = {
            getCredentials: vi.fn().mockResolvedValue({}),
            updateLastSyncAt: vi.fn()
        };
        const mockSyncJobRepo: any = {
            markCompleted: vi.fn()
        };
        const mockChangeDetection: any = {
            computeHash: vi.fn(),
            hasChanged: vi.fn(),
            needsImageEnrichment: vi.fn()
        };
        const mockMarkStale: any = {
            execute: vi.fn()
        };

        const useCase = new RunSyncJobUseCase(
            {} as any,
            mockShopifyClient,
            mockStagingRepo,
            mockConnectorRepo,
            mockSyncJobRepo,
            mockChangeDetection,
            mockMarkStale
        );

        const job: any = { id: "job1", tenantId: "t1", progress: {} };
        await useCase.execute(job);

        // Verify saveCursor calls
        const saveCursorCalls = mockStagingRepo.saveCursor.mock.calls;

        // After products sync
        expect(saveCursorCalls[0][2]).toEqual({
            productsCursor: "p_new",
            customersCursor: null,
            ordersCursor: null
        });

        // After customers sync
        expect(saveCursorCalls[1][2]).toEqual({
            productsCursor: "p_new",
            customersCursor: "c_new",
            ordersCursor: null
        });

        // After orders sync
        expect(saveCursorCalls[2][2]).toEqual({
            productsCursor: "p_new",
            customersCursor: "c_new",
            ordersCursor: "o_new"
        });
    });
});
