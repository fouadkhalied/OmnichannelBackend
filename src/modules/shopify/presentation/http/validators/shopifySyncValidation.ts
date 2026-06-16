import { z } from "zod";

export const shopifySyncValidation = z.object({
    body: z.object({
        action: z.enum(["full", "retry_failed"]).optional().default("full"),
    }),
});