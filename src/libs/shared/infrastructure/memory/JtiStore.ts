/**
 * In-memory JTI whitelist.
 *
 * Replaces Redis for environments where Redis is not available.
 * Each JTI entry carries an expiry timestamp; a background interval
 * sweeps stale entries every 5 minutes to prevent unbounded growth.
 *
 * IMPORTANT: This store is per-process. In a multi-instance deployment
 * every instance holds its own store, so a token issued by instance A
 * may be rejected by instance B after a restart of A. Switch to Redis
 * when you need cross-instance consistency.
 */

interface JtiEntry {
    userId: string;
    expiresAt: number; // Unix ms
}

const store = new Map<string, JtiEntry>();

// Sweep expired entries every 5 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [jti, entry] of store) {
        if (entry.expiresAt < now) {
            store.delete(jti);
        }
    }
}, SWEEP_INTERVAL_MS).unref(); // .unref() so the timer doesn't block process exit

export const JtiStore = {
    /**
     * Register a JTI as valid until `expiresAt`.
     */
    set(jti: string, userId: string, expiresAt: number): void {
        store.set(jti, { userId, expiresAt });
    },

    /**
     * Returns the entry if the JTI is valid and not expired, otherwise null.
     */
    get(jti: string): JtiEntry | null {
        const entry = store.get(jti);
        if (!entry) return null;
        if (entry.expiresAt < Date.now()) {
            store.delete(jti);
            return null;
        }
        return entry;
    },

    /**
     * Revoke a JTI (logout).
     */
    delete(jti: string): void {
        store.delete(jti);
    },

    /** Returns the number of active entries (for diagnostics). */
    size(): number {
        return store.size;
    },
};
