import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "../../schema/index";
import { env } from "../../../../config/env";
import { logger } from "../../../common/logger";
// ─── Pool Configuration ───────────────────────────────────────────────────────

const POOL_CONFIG: PoolConfig = {
    connectionString: env.DATABASE_URL,

    // connection pool sizing
    min: 2,                // keep minimum connections alive
    max: 10,               // max connections per instance

    // timeouts
    connectionTimeoutMillis: 5_000,   // fail fast if cant get connection from pool
    idleTimeoutMillis: 30_000,        // release idle connections after 30s
    statement_timeout: 30_000,        // kill queries running over 30s
    query_timeout: 30_000,

    // keep connections alive through load balancers / firewalls
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,

    // ssl
    ssl: env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : false,
};

// ─── Pool Instance ────────────────────────────────────────────────────────────

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let isConnected = false;
let connectAttempts = 0;

const MAX_CONNECT_ATTEMPTS = 5;
const RETRY_DELAY_MS = [1_000, 2_000, 4_000, 8_000, 16_000]; // exponential backoff

// ─── Connection ───────────────────────────────────────────────────────────────

export async function connectPostgres(): Promise<void> {
    if (!env.DATABASE_URL) {
        logger.warn("postgres.skipped", {
            reason: "DATABASE_URL not set",
        });
        return;
    }

    if (isConnected) {
        logger.warn("postgres.already_connected");
        return;
    }

    pool = new Pool(POOL_CONFIG);

    // ── pool-level event listeners ──

    pool.on("connect", (client: any) => {
        // enforce row-level tenant scoping at connection level
        client.query("SET app.current_tenant = ''").catch(() => { });
        logger.debug("postgres.client_connected", {
            totalCount: pool?.totalCount,
            idleCount: pool?.idleCount,
        });
    });

    pool.on("acquire", () => {
        logger.debug("postgres.client_acquired", {
            totalCount: pool?.totalCount,
            idleCount: pool?.idleCount,
            waitingCount: pool?.waitingCount,
        });
    });

    pool.on("remove", () => {
        logger.debug("postgres.client_removed", {
            totalCount: pool?.totalCount,
        });
    });

    pool.on("error", (error: Error) => {
        logger.error("postgres.pool_error", {
            error: error.message,
        });
        // don't crash — pool will attempt to recover
        // but mark as disconnected so health checks fail
        isConnected = false;
    });

    // ── attempt connection with retry ──

    while (connectAttempts < MAX_CONNECT_ATTEMPTS) {
        connectAttempts++;

        try {
            logger.info("postgres.connect_attempt", {
                attempt: connectAttempts,
                maxAttempts: MAX_CONNECT_ATTEMPTS,
            });

            // verify connection is actually reachable
            const client = await pool.connect();
            const result = await client.query("SELECT version(), current_database()");
            client.release();

            const { version, current_database } = result.rows[0];

            db = drizzle(pool as any, { schema });
            isConnected = true;
            connectAttempts = 0; // reset for future reconnect attempts

            logger.info("postgres.connected", {
                database: current_database,
                version: version.split(" ").slice(0, 2).join(" "),
                poolMin: POOL_CONFIG.min,
                poolMax: POOL_CONFIG.max,
            });

            return;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isLastAttempt = connectAttempts >= MAX_CONNECT_ATTEMPTS;

            logger.error("postgres.connect_failed", {
                attempt: connectAttempts,
                maxAttempts: MAX_CONNECT_ATTEMPTS,
                error: message,
            });

            if (isLastAttempt) {
                await pool.end().catch(() => { });
                pool = null;
                db = null;
                throw new Error(
                    `Failed to connect to PostgreSQL after ${MAX_CONNECT_ATTEMPTS} attempts: ${message}`
                );
            }

            const delayMs = RETRY_DELAY_MS[connectAttempts - 1] ?? 16_000;
            logger.info("postgres.retry_scheduled", {
                delayMs,
                nextAttempt: connectAttempts + 1,
            });
            await delay(delayMs);
        }
    }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectPostgres(): Promise<void> {
    if (!pool) return;

    try {
        await pool.end();
        pool = null;
        db = null;
        isConnected = false;
        logger.info("postgres.disconnected");
    } catch (error) {
        logger.error("postgres.disconnect_error", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function checkPostgresHealth(): Promise<{
    status: "healthy" | "unhealthy";
    latencyMs?: number;
    error?: string;
    pool?: {
        total: number;
        idle: number;
        waiting: number;
    };
}> {
    if (!pool || !isConnected) {
        return { status: "unhealthy", error: "not_connected" };
    }

    const start = Date.now();
    try {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();

        return {
            status: "healthy",
            latencyMs: Date.now() - start,
            pool: {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount,
            },
        };
    } catch (error) {
        return {
            status: "unhealthy",
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ─── Require DB (safe accessor) ───────────────────────────────────────────────

export function requireDb() {
    if (!db || !isConnected) {
        throw new Error(
            "PostgreSQL is not connected. Ensure connectPostgres() completed successfully."
        );
    }
    return db;
}

export function getPool() {
    if (!pool || !isConnected) {
        throw new Error(
            "PostgreSQL pool is not available."
        );
    }
    return pool;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));