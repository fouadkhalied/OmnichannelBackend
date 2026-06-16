import crypto from "crypto";

const SALT = "shopify-connector-salt";
const KEY_LEN = 32;

/**
 * Encrypts a plaintext string using AES-256-GCM with scrypt key derivation.
 * Returns a base64-encoded string: iv(12) + tag(16) + ciphertext.
 */
export function encryptCredentials(plain: string, secret: string): string {
    const key = crypto.scryptSync(secret, SALT, KEY_LEN);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plain, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypts an AES-256-GCM encrypted base64 string.
 * Falls back to plain JSON parsing in dev mode (no secret provided).
 */
export function decryptCredentials(
    encrypted: string,
    secret: string | undefined,
): Record<string, unknown> {
    if (!secret) {
        return JSON.parse(encrypted);
    }
    try {
        const buffer = Buffer.from(encrypted, "base64");
        const iv = buffer.subarray(0, 12);
        const tag = buffer.subarray(12, 28);
        const ciphertext = buffer.subarray(28);
        const key = crypto.scryptSync(secret, SALT, KEY_LEN);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return JSON.parse(decrypted.toString("utf8"));
    } catch {
        // Fallback: stored as plain JSON (dev / test seed data)
        return JSON.parse(encrypted);
    }
}
