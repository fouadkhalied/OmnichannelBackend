import { logger } from "../../../common/logger";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export class HuggingFaceClient {
    constructor(private readonly hfUsername: string) { }

    async createSpace(name: string, token: string): Promise<{ url: string; name: string }> {
        try {
            const url = "https://huggingface.co/api/repos/create";
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: "space",
                    name,
                    sdk: "docker",
                    private: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HF Space creation failed: ${JSON.stringify(errorData)}`);
            }

            const spaceUrl = `https://huggingface.co/spaces/${this.hfUsername}/${name}`;
            return { url: spaceUrl, name };
        } catch (err) {
            logger.error("hf.create_space_failed", { name, error: String(err) });
            throw err;
        }
    }

    async setSecret(spaceName: string, token: string, key: string, value: string): Promise<void> {
        try {
            const url = `https://huggingface.co/api/spaces/${this.hfUsername}/${spaceName}/secrets`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ key, value })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HF Secret set failed: ${JSON.stringify(errorData)}`);
            }
        } catch (err) {
            logger.error("hf.set_secret_failed", { spaceName, key, error: String(err) });
            throw err;
        }
    }

    async pushDockerfile(spaceName: string, token: string, templateDir: string): Promise<void> {
        const repoUrl = `https://${this.hfUsername}:${token}@huggingface.co/spaces/${this.hfUsername}/${spaceName}`;
        const tempDir = path.join(process.cwd(), "tmp", `hf-${spaceName}`);

        try {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
            fs.mkdirSync(tempDir, { recursive: true });

            logger.info("hf.pushing_dockerfile", { spaceName, tempDir });

            execSync(`git clone ${repoUrl} ${tempDir}`, { stdio: 'inherit' });
            execSync(`cp -r ${templateDir}/* ${tempDir}/`, { stdio: 'inherit' });

            execSync(`git -C ${tempDir} config user.email "service@antigravity.ai"`, { stdio: 'inherit' });
            execSync(`git -C ${tempDir} config user.name "Omnichannel Service"`, { stdio: 'inherit' });

            execSync(`git -C ${tempDir} add .`, { stdio: 'inherit' });
            execSync(`git -C ${tempDir} commit -m "Deploy n8n instance"`, { stdio: 'inherit' });
            execSync(`git -C ${tempDir} push`, { stdio: 'inherit' });

            logger.info("hf.push_success", { spaceName });
        } catch (err) {
            logger.error("hf.push_failed", { spaceName, error: String(err) });
            throw err;
        } finally {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
        }
    }
}
