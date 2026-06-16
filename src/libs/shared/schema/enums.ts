export const platformEnum = ["shopify", "meta", "whatsapp"] as const;
export const aiStatusEnum = ["active", "archived", "disabled"] as const;
export const aiModeEnum = ["auto", "manual", "off"] as const;
export const messageDirectionEnum = ["inbound", "outbound"] as const;
export const broadcastStatusEnum = ["draft", "scheduled", "sent", "failed", "cancelled"] as const;

export type Platform = typeof platformEnum[number];
export type AiStatus = typeof aiStatusEnum[number];
export type AiMode = typeof aiModeEnum[number];
export type MessageDirection = typeof messageDirectionEnum[number];
export type BroadcastStatus = typeof broadcastStatusEnum[number];
