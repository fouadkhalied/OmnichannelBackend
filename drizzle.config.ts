import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dirname, "src", "config", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is not set. Checked: ${path.join(dirname, "src", "config", ".env")}`);
}

export default defineConfig({
  out: "./migrations",
  schema: "./src/libs/shared/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
