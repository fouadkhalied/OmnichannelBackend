import crypto from "crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Hash a plain-text password using scrypt.
 * Returns "<hex-salt>:<hex-hash>"
 */
export async function hashPassword(plain: string): Promise<string> {
    const salt = crypto.randomBytes(SALT_BYTES);
    const hash = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(plain, salt, KEY_BYTES, SCRYPT_PARAMS, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plain-text password against a stored hash string.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");
    const hash = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(plain, salt, KEY_BYTES, SCRYPT_PARAMS, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });
    return crypto.timingSafeEqual(hash, storedHash);
}
