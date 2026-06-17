import * as esbuild from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function build() {
    const start = Date.now();
    console.log("🚀 Starting build...");

    // Ensure dist directory exists
    if (!fs.existsSync("dist")) {
        fs.mkdirSync("dist");
    }

    try {
        console.log("📦 Bundling with esbuild...");
        await esbuild.build({
            entryPoints: ["server/index.ts"],
            bundle: true,
            platform: "node",
            target: "node20",
            outfile: "dist/index.cjs",
            format: "cjs",
            sourcemap: true,
            minify: false, // Keep it readable for debugging in production for now
            // We keep most heavy dependencies external if they have native bindings
            external: [
                "whatsapp-web.js",
                "pg",
                "mongoose",
                "express",
                "canvas",
                "bufferutil",
                "utf-8-validate",
                "fsevents",
                "@playwright/test",
                "vitest"
            ],
            loader: {
                ".ts": "ts",
            },
            alias: {
                "@shared": path.resolve(__dirname, "../src/libs/shared"),
            },
        });

        const end = Date.now();
        console.log(`✅ Build completed in ${((end - start) / 1000).toFixed(2)}s`);

        // Copy GraphQL queries to dist
        console.log("📂 Copying GraphQL queries...");
        const queriesSrc = path.resolve(__dirname, "../src/modules/shopify/infrastructure/shopify/graphql/queries");
        const queriesDist = path.resolve(process.cwd(), "dist/queries");

        if (!fs.existsSync(queriesDist)) {
            fs.mkdirSync(queriesDist, { recursive: true });
        }

        if (fs.existsSync(queriesSrc)) {
            fs.readdirSync(queriesSrc).forEach(file => {
                const srcFile = path.join(queriesSrc, file);
                const destFile = path.join(queriesDist, file);
                fs.copyFileSync(srcFile, destFile);
                console.log(`  📄 Copied ${file}`);
            });
        } else {
            console.warn("⚠️ Warning: Queries source directory not found:", queriesSrc);
        }

    } catch (error) {
        console.error("❌ Build failed:", error);
        process.exit(1);
    }
}

build();
