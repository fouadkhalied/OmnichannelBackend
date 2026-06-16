import { describe, it, expect } from "vitest";
import { ChangeDetectionService } from "../src/modules/shopify/domain/services/ChangeDetectionService";
import { ShopifyEntityType } from "../src/modules/shopify/domain/valueObjects/ShopifyEntityType";

describe("ChangeDetectionService", () => {
    const service = new ChangeDetectionService();
    const productType = ShopifyEntityType.fromString("product");

    it("should return true if imageSignature is missing", () => {
        const payload = { images: [{ id: "1", url: "http://example.com/1.png" }] };
        const stored: any = { payload, imageSignature: null };
        expect(service.needsImageEnrichment(productType, payload, stored)).toBe(true);
    });

    it("should return false if images and signature are unchanged", () => {
        const payload = { images: [{ id: "1", url: "http://example.com/1.png" }] };
        const stored: any = { payload, imageSignature: "sig" };
        expect(service.needsImageEnrichment(productType, payload, stored)).toBe(false);
    });

    it("should return true if image count changed", () => {
        const payload = { images: [{ id: "1", url: "http://example.com/1.png" }, { id: "2", url: "http://example.com/2.png" }] };
        const stored: any = { payload: { images: [{ id: "1", url: "http://example.com/1.png" }] }, imageSignature: "sig" };
        expect(service.needsImageEnrichment(productType, payload, stored)).toBe(true);
    });

    it("should return true if intermediate image URL changed", () => {
        const payload = { images: [{ id: "1", url: "http://example.com/new.png" }] };
        const stored: any = { payload: { images: [{ id: "1", url: "http://example.com/old.png" }] }, imageSignature: "sig" };
        expect(service.needsImageEnrichment(productType, payload, stored)).toBe(true);
    });
});
