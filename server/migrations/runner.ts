import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { env } from "../../src/config/env";
import { logger } from "../../src/libs/common/logger";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "infra/migrations/vectordb");

/**
 * Programmatically runs vector migrations against a specific database URL.
 */
export async function runVectorMigrations(dbUrl: string, command: "up" | "down" | "status" = "up") {
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        logger.info("vector_migration.connected", { dbUrl: dbUrl.substring(0, 20) + "..." });

        // Ensure migrations table exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith(".sql"))
            .sort();

        if (command === "up") {
            const upFiles = files.filter(f => f.endsWith(".up.sql"));
            const { rows } = await client.query("SELECT name FROM _migrations");
            const applied = new Set(rows.map(r => r.name));

            for (const file of upFiles) {
                if (!applied.has(file)) {
                    logger.info("vector_migration.applying", { file });
                    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

                    await client.query("BEGIN");
                    try {
                        await client.query(sql);
                        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
                        await client.query("COMMIT");
                        logger.info("vector_migration.success", { file });
                    } catch (err) {
                        await client.query("ROLLBACK");
                        logger.error("vector_migration.failed", { file, error: String(err) });
                        throw err;
                    }
                }
            }
            logger.info("vector_migration.complete");
        } else if (command === "down") {
            const { rows } = await client.query("SELECT name FROM _migrations ORDER BY id DESC LIMIT 1");
            if (rows.length === 0) {
                logger.info("vector_migration.nothing_to_rollback");
                return;
            }

            const lastMigration = rows[0].name;
            const downFile = lastMigration.replace(".up.sql", ".down.sql");
            const downPath = path.join(MIGRATIONS_DIR, downFile);

            if (!fs.existsSync(downPath)) {
                throw new Error(`Rollback file not found: ${downFile}`);
            }

            logger.info("vector_migration.rolling_back", { lastMigration });
            const sql = fs.readFileSync(downPath, "utf8");

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("DELETE FROM _migrations WHERE name = $1", [lastMigration]);
                await client.query("COMMIT");
                logger.info("vector_migration.rollback_success", { lastMigration });
            } catch (err) {
                await client.query("ROLLBACK");
                logger.error("vector_migration.rollback_failed", { lastMigration, error: String(err) });
                throw err;
            }
        } else if (command === "status") {
            const { rows } = await client.query("SELECT name, applied_at FROM _migrations ORDER BY id ASC");
            if (rows.length === 0) {
                console.log("ℹ️ No migrations applied yet.");
            } else {
                console.table(rows);
            }
        }
    } catch (err) {
        logger.error("vector_migration.crashed", { error: String(err) });
        throw err;
    } finally {
        await client.end();
    }
}
