import crypto from "crypto";
import { env } from "../../../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = "tenant-vault-salt";

export interface EncryptedData {
    ciphertext: string;
    iv: string;
}

/**
 * Vault utility for secure encryption of tenant credentials.
 * Returns IV and ciphertext separately for database storage.
 */
export class Vault {
    private static getEncryptionKey(secret: string): Buffer {
        return crypto.scryptSync(secret, SALT, KEY_LENGTH);
    }

    /**
     * Encrypts plaintext using AES-256-GCM.
     */
    static encrypt(plain: string, secret: string = env.CONNECTOR_ENCRYPTION_SECRET!, ivOverride?: string): EncryptedData {
        if (!secret) throw new Error("Encryption secret not configured.");

        const key = this.getEncryptionKey(secret);
        const iv = ivOverride ? Buffer.from(ivOverride, "base64") : crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const ciphertext = Buffer.concat([
            cipher.update(plain, "utf8"),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        return {
            ciphertext: Buffer.concat([ciphertext, authTag]).toString("base64"),
            iv: iv.toString("base64")
        };
    }

    /**
     * Decrypts ciphertext using the provided IV and AES-256-GCM.
     */
    static decrypt(encrypted: EncryptedData, secret: string = env.CONNECTOR_ENCRYPTION_SECRET!): string {
        if (!secret) throw new Error("Encryption secret not configured.");

        const key = this.getEncryptionKey(secret);
        const ivBuffer = Buffer.from(encrypted.iv, "base64");
        const fullCiphertext = Buffer.from(encrypted.ciphertext, "base64");

        const authTag = fullCiphertext.subarray(fullCiphertext.length - TAG_LENGTH);
        const ciphertext = fullCiphertext.subarray(0, fullCiphertext.length - TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);

        return decrypted.toString("utf8");
    }
}
