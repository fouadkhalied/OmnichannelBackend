import crypto from "crypto";

const STATE_VERSION = "v1";

export interface ShopifyOauthStatePayload {
    userId: string;
    organizationId: string;
    storeId: string;
    shopDomain: string;
    clientId: string;
    apiVersion: string;
    nonce: string;
    iat: number;
    exp: number;
}

/**
 * Signs a Shopify OAuth state payload into a compact string token.
 * Format: v1.base64url(payload).HMAC-SHA256(v1.base64url(payload), secret)
 * Note: clientSecret is intentionally excluded from the state payload for security.
 */
export function createSignedShopifyOauthState(
    payload: ShopifyOauthStatePayload,
    secret: string,
): string {
    const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto
        .createHmac("sha256", secret)
        .update(`${STATE_VERSION}.${json}`)
        .digest("base64url");
    return `${STATE_VERSION}.${json}.${sig}`;
}

/**
 * Verifies and parses a signed Shopify OAuth state token.
 * Returns null if the signature is invalid or token is expired.
 */
export function verifySignedShopifyOauthState(
    token: string,
    secret: string,
): ShopifyOauthStatePayload | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [version, json, sig] = parts;
    if (version !== STATE_VERSION) return null;

    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${version}.${json}`)
        .digest("base64url");

    if (
        !crypto.timingSafeEqual(
            Buffer.from(sig, "base64url"),
            Buffer.from(expected, "base64url"),
        )
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(json, "base64url").toString("utf8"),
        ) as ShopifyOauthStatePayload;

        if (Date.now() > payload.exp) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Verifies the HMAC on a Shopify OAuth callback query string.
 * Shopify signs the query params (excluding `hmac`) using the app's client secret.
 */
export function verifyShopifyCallbackHmac(input: {
    rawQuery: string;
    clientSecret: string;
}): boolean {
    const params = new URLSearchParams(input.rawQuery);
    const receivedHmac = params.get("hmac") ?? "";
    params.delete("hmac");

    const sortedQuery = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

    const computed = crypto
        .createHmac("sha256", input.clientSecret)
        .update(sortedQuery)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(computed, "hex"),
            Buffer.from(receivedHmac, "hex"),
        );
    } catch {
        return false;
    }
}

/**
 * Normalizes and validates a Shopify shop domain.
 * Returns the normalized domain (lowercase, no protocol/trailing slash).
 * Throws if the format is invalid.
 */
export function normalizeAndValidateShopDomain(shopDomain: string): string {
    const normalized = shopDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");

    if (!/^[a-z0-9-]+\.myshopify\.com$/.test(normalized)) {
        throw new Error(`Invalid Shopify shop domain: ${shopDomain}`);
    }

    return normalized;
}