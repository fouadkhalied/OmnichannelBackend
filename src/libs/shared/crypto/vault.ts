// libs/shared/crypto/Vault.ts

import crypto from "crypto";
import { env } from "src/config/env";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex"); // 32 bytes = 64 hex chars

export class Vault {
    static encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, "utf8"),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        // format: iv(12):tag(16):ciphertext — all base64
        return [
            iv.toString("base64"),
            tag.toString("base64"),
            encrypted.toString("base64"),
        ].join(":");
    }

    static decrypt(blob: string): string {
        const [ivB64, tagB64, dataB64] = blob.split(":");
        const iv = Buffer.from(ivB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const data = Buffer.from(dataB64, "base64");
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    }
}