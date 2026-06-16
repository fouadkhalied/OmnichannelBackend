
export const ImageEnrichmentUtils = {
    collectProductImagesForEnrichment(payload: any): string[] {
        if (!payload || !payload.images) return [];
        return payload.images.map((img: any) => img.url).filter(Boolean);
    },

    computeProductImageAnalysisSignature(payload: any): string {
        if (!payload || !payload.images) return "no_images";
        const imageIdentifiers = payload.images
            .map((img: any) => `${img.id}-${img.url}`)
            .sort()
            .join("|");

        // Simple deterministic hash
        let hash = 0;
        for (let i = 0; i < imageIdentifiers.length; i++) {
            const char = imageIdentifiers.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return `sig_${hash}`;
    },

    mergeVisualDescriptors(descriptorGroups: string[][]): string[] {
        const allDescriptors = descriptorGroups.flat();
        const uniqueDescriptors = Array.from(new Set(allDescriptors.map(d => d.toLowerCase().trim())));
        return uniqueDescriptors.filter(d => d.length > 0);
    }
};
