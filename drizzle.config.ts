import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Try root .env first, then fallback to src/config/.env
const rootEnv = path.join(dirname, ".env");
const configEnv = path.join(dirname, "src", "config", ".env");

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config({ path: configEnv });
}

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is not set. Checked: ${rootEnv} and ${configEnv}`);
}

export default defineConfig({
  out: "./migrations",
  schema: "./src/libs/shared/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
