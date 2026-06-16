import { PayloadHash } from "../valueObjects/PayloadHash";
import { ShopifyEntityType } from "../valueObjects/ShopifyEntityType";
import { StagingRecord } from "../repositories/IStagingRepository";

export class ChangeDetectionService {
    computeHash(payload: unknown): PayloadHash {
        return PayloadHash.compute(payload);
    }

    hasChanged(incoming: PayloadHash, stored: StagingRecord | null): boolean {
        if (!stored) return true; // New entity
        if (stored.deleted) return true; // Resurrection
        return stored.payloadHash !== incoming.value;
    }

    detectDeletions(seenExternalIds: Set<string>, storedExternalIds: string[]): string[] {
        return storedExternalIds.filter((id) => !seenExternalIds.has(id));
    }

    needsImageEnrichment(
        entityType: ShopifyEntityType,
        payload: any,
        storedRecord: StagingRecord | null
    ): boolean {
        if (!entityType.requiresImageEnrichment()) return false;

        const hasImages = Array.isArray(payload?.images) && payload.images.length > 0;
        if (!hasImages) return false;

        // Re-enrich if no previous signature or if images have changed
        if (!storedRecord || !storedRecord.imageSignature) return true;

        // Compare image IDs and counts
        const storedPayload = storedRecord.payload as any;
        const incomingImages = payload.images || [];
        const storedImages = storedPayload.images || [];

        if (incomingImages.length !== storedImages.length) return true;

        // Check for ID mismatches or URL changes
        for (let i = 0; i < incomingImages.length; i++) {
            if (incomingImages[i].id !== storedImages[i].id) return true;
            if (incomingImages[i].url !== storedImages[i].url) return true;
        }

        return false;
    }
}
