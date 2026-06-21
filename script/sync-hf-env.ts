import fs from "fs";
import path from "path";
import dotenv from "dotenv";

async function syncEnv() {
    const envPath = path.resolve(process.cwd(), ".env");

    if (!fs.existsSync(envPath)) {
        console.error("❌ .env file not found at:", envPath);
        process.exit(1);
    }

    // Load .env content
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
        console.error("❌ HF_TOKEN environment variable is missing.");
        console.log("Please run: export HF_TOKEN=your_token (or set it in your environment)");
        process.exit(1);
    }

    const repoId = "fouadkhalid123/asd";
    const apiUrl = `https://huggingface.co/api/spaces/${repoId}/secrets`;

    console.log(`🚀 Syncing ${Object.keys(envConfig).length} variables to Hugging Face Space: ${repoId}...`);

    for (const [key, value] of Object.entries(envConfig)) {
        if (!value) continue;

        try {
            console.log(`📤 Syncing: ${key}...`);
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                    "User-Agent": "HF-Sync-Script/1.0",
                },
                body: JSON.stringify({ key, value }),
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error(`❌ Failed to sync ${key}:`, response.status, responseData);
                // 403 often means missing scope or wrong headers
                if (response.status === 403) {
                    console.error("💡 TIP: Verify your HF_TOKEN has 'Write' access to this specific Space and its Secrets.");
                }
            } else {
                console.log(`✅ ${key} synced successfully.`);
            }
        } catch (error) {
            console.error(`❌ Error syncing ${key}:`, error);
        }
    }

    console.log("\n✨ Sync completed!");
}

syncEnv();
