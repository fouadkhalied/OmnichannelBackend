import { createHash } from "crypto";

export class PayloadHash {
    private constructor(public readonly value: string) { }

    static compute(payload: unknown): PayloadHash {
        const normalized = this.normalize(payload);
        const json = JSON.stringify(normalized);
        const hash = createHash("sha256").update(json).digest("hex");
        return new PayloadHash(hash);
    }

    equals(other: PayloadHash): boolean {
        return this.value === other.value;
    }

    private static normalize(obj: unknown): unknown {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.normalize(item));
        }

        const sortedObj: any = {};
        const keys = Object.keys(obj as object).sort();
        for (const key of keys) {
            sortedObj[key] = this.normalize((obj as any)[key]);
        }
        return sortedObj;
    }

    static fromString(hash: string): PayloadHash {
        return new PayloadHash(hash);
    }
}
